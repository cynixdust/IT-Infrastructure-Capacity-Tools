export interface VcpuResult {
  capacity: number;
  observed: number;
  utilization: number;
  headroom: number;
  status: {
    cls: 'ok' | 'hi' | 'ov';
    label: string;
    msg: string;
  };
}

export interface PcpuResult {
  totalCores: number;
  totalLogical: number;
  peakGhz: number;
  usedGhz: number;
  utilization: number;
  estPower: number | null;
  status: {
    cls: 'ok' | 'hi' | 'ov';
    label: string;
    msg: string;
  };
}

export interface SubnetResult {
  network: string;
  broadcast: string;
  mask: string;
  wildcard: string;
  cidr: string;
  range: string;
  hosts: number;
  ipClass: string;
  binMask: string;
  ipType: string;
  splits: SubnetSplit[];
}

export interface SubnetSplit {
  cidr: string;
  hosts: number;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
}

export interface StorageResult {
  raw: number;
  usable: number;
  netAvail: number;
  used: number;
  free: number;
  utilization: number;
  status: {
    cls: 'ok' | 'hi' | 'ov';
    label: string;
    msg: string;
  };
}
