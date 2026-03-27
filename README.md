# IT Infrastructure Capacity Tools

A comprehensive React-based application for infrastructure planning and capacity calculations. This tool provides calculators for vCPU utilization, physical CPU capacity, subnetting, and storage capacity, with real-time visualizations and export capabilities.

## Features

- **vCPU Utilization**: Calculate and visualize vCPU capacity vs. observed utilization.
- **Physical CPU**: Detailed physical CPU analysis including peak GHz, used GHz, and estimated power consumption.
- **Subnet Calculator**: Full IPv4 subnetting tool with CIDR support and detailed split analysis.
- **Storage Capacity**: RAID-aware storage capacity calculator with overhead and utilization tracking.
- **Multi-Theme Support**: Five distinct color themes (Light, Dark, Slate, Emerald, Amber).
- **Export Options**: Export your calculation history to CSV, Excel (XLSX), or PDF.
- **Custom Branding**: Upload your own logo for branded PDF reports.

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript
- **Styling**: Tailwind CSS 4.0
- **Animations**: Motion (framer-motion)
- **Icons**: Lucide React
- **Data Export**: jsPDF, XLSX (SheetJS)
- **Charts**: Recharts

---

## Local Development

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run the development server**:
   ```bash
   npm run dev
   ```
4. **Build for production**:
   ```bash
   npm run build
   ```

---

## IIS Deployment Guide (Step-by-Step)

To host this application on a Windows Server using Internet Information Services (IIS), follow these detailed steps.

### 1. Prerequisites
- **Windows Server** with IIS installed.
- **IIS URL Rewrite Module**: [Download and install here](https://www.iis.net/downloads/microsoft/url-rewrite). This is **required** for client-side routing (SPAs) to work.
- **Node.js**: Installed on your build machine (not necessarily the server).

### 2. Build the Application
On your development machine, run the build command:
```bash
npm run build
```
This will create a `dist` folder in your project root containing all static assets.

### 3. Prepare the Server Folder
1. Create a directory on your server where the app will live (e.g., `C:\inetpub\wwwroot\infra-tools`).
2. Copy the entire contents of the `dist` folder from your build machine to this server directory.
3. Ensure the `web.config` file is present in the root of this folder (it is automatically included if you copied from `dist`).

### 4. Configure IIS
1. Open **IIS Manager** (`inetmgr`).
2. Right-click **Sites** and select **Add Website**.
3. **Site name**: `IT-Infra-Tools`
4. **Physical path**: Point to your server folder (e.g., `C:\inetpub\wwwroot\infra-tools`).
5. **Binding**: Set your desired port (e.g., `80` or `8080`) and hostname if applicable.
6. Click **OK**.

### 5. Verify Permissions
Ensure the IIS AppPool user has **Read** permissions for the physical path:
1. Right-click your site folder in Windows Explorer.
2. Go to **Properties** > **Security**.
3. Add `IIS AppPool\IT-Infra-Tools` (or `IIS_IUSRS`) and give it **Read & execute** permissions.

### 6. Troubleshooting Routing
If you refresh the page on a sub-route (e.g., `/subnet`) and get a **404 Error**, it means the **URL Rewrite Module** is not working or the `web.config` is missing. The `web.config` provided in this project handles this by redirecting all non-file requests to `index.html`.

---

## License

SPDX-License-Identifier: Apache-2.0
