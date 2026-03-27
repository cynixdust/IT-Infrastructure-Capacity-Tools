import { VcpuResult, PcpuResult, SubnetResult, StorageResult, SubnetSplit } from "./types";

export function calculateVcpu(vcpu: number, freq: number, util: number): VcpuResult {
  const capacity = vcpu * freq;
  const utilization = (util / capacity) * 100;
  const headroom = capacity - util;

  let status: VcpuResult['status'];
  if (utilization <= 80) {
    status = { cls: 'ok', label: 'Normal', msg: 'Workload is within allocated capacity.' };
  } else if (utilization <= 100) {
    status = { cls: 'hi', label: 'High', msg: 'Utilization is elevated. Monitor closely.' };
  } else {
    status = { cls: 'ov', label: 'Overutilized', msg: 'Workload demand exceeds allocated capacity — possible contention or overcommitment.' };
  }

  return { capacity, observed: util, utilization, headroom, status };
}

export function calculatePcpu(sockets: number, cores: number, threads: number, freq: number, utilPct: number, tdp: number | null): PcpuResult {
  const totalCores = sockets * cores;
  const totalLogical = totalCores * threads;
  const peakGhz = totalLogical * freq;
  const usedGhz = peakGhz * (utilPct / 100);
  const estPower = tdp !== null ? sockets * tdp * (utilPct / 100) : null;

  let status: PcpuResult['status'];
  if (utilPct <= 80) {
    status = { cls: 'ok', label: 'Normal', msg: 'Workload is within allocated capacity.' };
  } else if (utilPct <= 100) {
    status = { cls: 'hi', label: 'High', msg: 'Utilization is elevated. Monitor closely.' };
  } else {
    status = { cls: 'ov', label: 'Overutilized', msg: 'Workload demand exceeds allocated capacity — possible contention or overcommitment.' };
  }

  return { totalCores, totalLogical, peakGhz, usedGhz, utilization: utilPct, estPower, status };
}

export function ipToNum(ip: string): number {
  return ip.split('.').reduce((a, o) => (a << 8) | +o, 0) >>> 0;
}

export function numToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export function prefixToMask(p: number): number {
  return p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0;
}

export function calculateSubnet(ipStr: string, maskStr: string): SubnetResult | null {
  const parseMask = (mk: string): number | null => {
    mk = mk.trim();
    if (/^\/?\d{1,2}$/.test(mk)) {
      const p = parseInt(mk.replace('/', ''));
      return (p >= 0 && p <= 32) ? p : null;
    }
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(mk)) {
      const parts = mk.split('.').map(Number);
      if (parts.some(p => p > 255)) return null;
      const bin = parts.map(p => p.toString(2).padStart(8, '0')).join('');
      if (!/^1*0*$/.test(bin)) return null;
      return bin.split('').filter(b => b === '1').length;
    }
    return null;
  };

  const prefix = parseMask(maskStr);
  if (prefix === null) return null;

  const maskNum = prefixToMask(prefix);
  const ipNum = ipToNum(ipStr);
  const networkNum = ipNum & maskNum;
  const broadcastNum = networkNum | (~maskNum >>> 0);
  const firstHost = prefix < 31 ? networkNum + 1 : networkNum;
  const lastHost = prefix < 31 ? broadcastNum - 1 : broadcastNum;
  const totalHosts = Math.pow(2, 32 - prefix);
  const usableHosts = prefix <= 30 ? totalHosts - 2 : prefix === 31 ? 2 : 1;
  const wildcardNum = ~maskNum >>> 0;
  const binMask = maskNum.toString(2).padStart(32, '0').match(/.{8}/g)!.join('.');

  const getIpClass = (first: number) => {
    if (first < 128) return 'A';
    if (first < 192) return 'B';
    if (first < 224) return 'C';
    if (first < 240) return 'D (Multicast)';
    return 'E (Reserved)';
  };

  const getIpType = (ip: string) => {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return 'Private (RFC1918)';
    if (a === 172 && b >= 16 && b <= 31) return 'Private (RFC1918)';
    if (a === 192 && b === 168) return 'Private (RFC1918)';
    if (a === 127) return 'Loopback';
    if (a === 169 && b === 254) return 'Link-Local (APIPA)';
    if (a >= 224 && a <= 239) return 'Multicast';
    return 'Public';
  };

  const splits: SubnetSplit[] = [];
  const splitPrefix = Math.max(prefix, 24);
  const splitCount = Math.pow(2, splitPrefix - prefix);
  const blockSize = Math.pow(2, 32 - splitPrefix);
  const rows = Math.min(splitCount, 64);

  for (let i = 0; i < rows; i++) {
    const netN = networkNum + i * blockSize;
    const bcN = netN + blockSize - 1;
    const fh = splitPrefix < 31 ? netN + 1 : netN;
    const lh = splitPrefix < 31 ? bcN - 1 : bcN;
    const h = splitPrefix <= 30 ? blockSize - 2 : blockSize;
    splits.push({
      cidr: `/${splitPrefix}`,
      hosts: h,
      network: numToIp(netN),
      broadcast: numToIp(bcN),
      firstHost: numToIp(fh),
      lastHost: numToIp(lh)
    });
  }

  return {
    network: numToIp(networkNum),
    broadcast: numToIp(broadcastNum),
    mask: numToIp(maskNum),
    wildcard: numToIp(wildcardNum),
    cidr: `/${prefix}`,
    range: `${numToIp(firstHost)} — ${numToIp(lastHost)}`,
    hosts: usableHosts,
    ipClass: getIpClass(+ipStr.split('.')[0]),
    binMask,
    ipType: getIpType(ipStr),
    splits
  };
}

export function calculateStorage(drives: number, cap: number, raid: string, used: number, overhead: number, unit: 'GB' | 'TB'): StorageResult {
  // Convert all to TB for internal calculation
  const factor = unit === 'GB' ? 1024 : 1;
  const capTB = cap / factor;
  const usedTB = used / factor;

  const rawTB = drives * capTB;
  
  const getRaidUsable = (raw: number, drives: number, raid: string) => {
    switch (raid) {
      case '0': return raw;
      case '1': return raw / 2;
      case '5': return raw * (drives - 1) / drives;
      case '6': return raw * (drives - 2) / drives;
      case '10': return raw / 2;
      case 'none': return raw;
      default: return raw;
    }
  };

  const usableTB = getRaidUsable(rawTB, drives, raid);
  const netAvailTB = usableTB * (1 - overhead / 100);
  const freeTB = Math.max(netAvailTB - usedTB, 0);
  const utilization = (usedTB / netAvailTB) * 100;

  let status: StorageResult['status'];
  if (utilization <= 70) {
    status = { cls: 'ok', label: 'Normal', msg: 'Storage utilization is healthy with adequate headroom.' };
  } else if (utilization <= 85) {
    status = { cls: 'hi', label: 'High', msg: 'Utilization is elevated. Plan for capacity expansion.' };
  } else {
    status = { cls: 'ov', label: 'Critical', msg: 'Storage is critically full. Immediate expansion or cleanup required.' };
  }

  // Convert back to the requested unit for the result
  return { 
    raw: rawTB * factor, 
    usable: usableTB * factor, 
    netAvail: netAvailTB * factor, 
    used: usedTB * factor, 
    free: freeTB * factor, 
    utilization, 
    status 
  };
}
