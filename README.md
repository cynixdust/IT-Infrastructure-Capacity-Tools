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

## XAMPP Deployment Guide (Step-by-Step)

To host this application on a local development environment using XAMPP (Apache), follow these steps.

### 1. Prerequisites
- **XAMPP** installed (usually in `C:\xampp`).
- **Node.js**: Installed on your build machine.

### 2. Build the Application
On your development machine, run the build command:
```bash
npm run build
```
This will create a `dist` folder in your project root.

### 3. Prepare the XAMPP Folder
1. Open your XAMPP installation directory (default: `C:\xampp\htdocs`).
2. Create a new folder named `infra-tools`.
3. Copy the entire contents of the `dist` folder to `C:\xampp\htdocs\infra-tools`.
4. Ensure the `.htaccess` file is present in the root of this folder (it is automatically included if you copied from `dist`).

### 4. Start Apache
1. Open the **XAMPP Control Panel**.
2. Click **Start** next to the **Apache** module.

### 5. Access the Application
Open your browser and navigate to:
`http://localhost/infra-tools`

### 6. Using the Standalone Version
If you don't want to deal with build processes or Node.js on the server:
1. Copy the `standalone.html` file from the project root to `C:\xampp\htdocs\infra-tools`.
2. Rename it to `index.html`.
3. Access it via `http://localhost/infra-tools`.

### 7. Troubleshooting (White Page)
If you see a **white page** after deploying to XAMPP:
1. **Check the Console**: Press `F12` and check for `404 Not Found` errors for JS/CSS files.
2. **Base Path**: Ensure you have rebuilt the app with `base: './'` in `vite.config.ts` (this is now the default in this project).
3. **Rebuild**: Run `npm run build` again and copy the *new* contents of the `dist` folder to `htdocs/infra-tools`.
4. **Browser Cache**: Try clearing your browser cache or opening in Incognito mode.

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
