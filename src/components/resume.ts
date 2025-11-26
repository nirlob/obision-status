import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';
import { SettingsService } from '../services/settings-service';

export class ResumeComponent {
  private container: Gtk.Box;
  private cpuLabel!: Gtk.Label;
  private gpuLabel!: Gtk.Label;
  private memoryLabel!: Gtk.Label;
  private diskLabel!: Gtk.Label;
  private networkLabel!: Gtk.Label;
  private cpuChart!: Gtk.DrawingArea;
  private gpuChart!: Gtk.DrawingArea;
  private memoryChart!: Gtk.DrawingArea;
  private diskChart!: Gtk.DrawingArea;
  private networkChart!: Gtk.DrawingArea;
  private cpuTempChart!: Gtk.DrawingArea;
  private gpuTempChart!: Gtk.DrawingArea;
  private cpuTempLabel!: Gtk.Label;
  private gpuTempLabel!: Gtk.Label;
  private load1minLabel!: Gtk.Label;
  private load5minLabel!: Gtk.Label;
  private load15minLabel!: Gtk.Label;
  private load1minBar!: Gtk.LevelBar;
  private load5minBar!: Gtk.LevelBar;
  private load15minBar!: Gtk.LevelBar;
  private topProcessesList!: Gtk.ListBox;
  private systemInfoList!: Gtk.ListBox;
  private updateTimeoutId: number | null = null;
  private settingsHandlerId: number | null = null;
  private utils: UtilsService;
  private settings: SettingsService;
  private cpuUsage: number = 0;
  private gpuUsage: number = 0;
  private memoryUsage: number = 0;
  private diskUsage: number = 0;
  private networkDownloadSpeed: number = 0;
  private networkUploadSpeed: number = 0;
  private cpuTemp: number = 0;
  private gpuTemp: number = 0;

  constructor() {
    this.utils = UtilsService.instance;
    this.settings = SettingsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obysion.ObysionSystem/ui/resume.ui');
      } catch (e) {
        builder.add_from_file('data/ui/resume.ui');
      }
    } catch (e) {
      console.error('Could not load resume.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('resume_container') as Gtk.Box;
    this.cpuLabel = builder.get_object('cpu_value') as Gtk.Label;
    this.gpuLabel = builder.get_object('gpu_value_resume') as Gtk.Label;
    this.memoryLabel = builder.get_object('memory_value') as Gtk.Label;
    this.diskLabel = builder.get_object('disk_value') as Gtk.Label;
    this.networkLabel = builder.get_object('network_value') as Gtk.Label;
    this.cpuChart = builder.get_object('cpu_chart') as Gtk.DrawingArea;
    this.gpuChart = builder.get_object('gpu_chart_resume') as Gtk.DrawingArea;
    this.memoryChart = builder.get_object('memory_chart') as Gtk.DrawingArea;
    this.diskChart = builder.get_object('disk_chart') as Gtk.DrawingArea;
    this.networkChart = builder.get_object('network_chart') as Gtk.DrawingArea;
    this.cpuTempChart = builder.get_object('cpu_temp_chart') as Gtk.DrawingArea;
    this.gpuTempChart = builder.get_object('gpu_temp_chart') as Gtk.DrawingArea;
    this.cpuTempLabel = builder.get_object('cpu_temp_value') as Gtk.Label;
    this.gpuTempLabel = builder.get_object('gpu_temp_value') as Gtk.Label;
    this.load1minLabel = builder.get_object('load_1min') as Gtk.Label;
    this.load5minLabel = builder.get_object('load_5min') as Gtk.Label;
    this.load15minLabel = builder.get_object('load_15min') as Gtk.Label;
    this.load1minBar = builder.get_object('load_1min_bar') as Gtk.LevelBar;
    this.load5minBar = builder.get_object('load_5min_bar') as Gtk.LevelBar;
    this.load15minBar = builder.get_object('load_15min_bar') as Gtk.LevelBar;
    this.topProcessesList = builder.get_object('top_processes_list') as Gtk.ListBox;
    this.systemInfoList = builder.get_object('system_info_list') as Gtk.ListBox;
    
    // Setup drawing functions
    this.cpuChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.cpuUsage);
    });
    
    this.gpuChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.gpuUsage);
    });
    
    this.memoryChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.memoryUsage);
    });
    
    this.diskChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.diskUsage);
    });
    
    this.networkChart.set_draw_func((area, cr, width, height) => {
      this.drawNetworkChart(cr, width, height);
    });
    
    this.cpuTempChart.set_draw_func((area, cr, width, height) => {
      this.drawTemperatureChart(cr, width, height, this.cpuTemp);
    });
    
    this.gpuTempChart.set_draw_func((area, cr, width, height) => {
      this.drawTemperatureChart(cr, width, height, this.gpuTemp);
    });
    
    // Initial update
    this.updateData();
    
    // Setup update interval from settings
    this.setupUpdateInterval();
    
    // Listen for refresh interval changes
    this.settingsHandlerId = this.settings.connectRefreshIntervalChanged(() => {
      this.setupUpdateInterval();
    });
  }

  private drawCircularChart(cr: any, width: number, height: number, percentage: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    const lineWidth = 12;
    
    // Gap at bottom (in radians)
    const gapAngle = Math.PI / 2.5; // 70 degrees gap at bottom
    const startAngle = Math.PI / 2 + gapAngle / 2; // Start after gap
    const backgroundEndAngle = startAngle + (2 * Math.PI - gapAngle); // End before gap
    
    // Background arc (open at bottom)
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, radius, startAngle, backgroundEndAngle);
    cr.stroke();
    
    // Progress arc
    const maxAngle = 2 * Math.PI - gapAngle;
    const progressAngle = maxAngle * percentage / 100;
    const endAngle = startAngle + progressAngle;
    
    // Color gradient based on percentage
    if (percentage < 50) {
      cr.setSourceRGBA(0.2, 0.7, 0.3, 1); // Green
    } else if (percentage < 80) {
      cr.setSourceRGBA(0.9, 0.7, 0.1, 1); // Yellow
    } else {
      cr.setSourceRGBA(0.9, 0.2, 0.2, 1); // Red
    }
    
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, radius, startAngle, endAngle);
    cr.stroke();
  }

  private drawNetworkChart(cr: any, width: number, height: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius - 18;
    const lineWidth = 12;
    
    // Gap at bottom (in radians)
    const gapAngle = Math.PI / 2.5; // 70 degrees gap at bottom
    const startAngle = Math.PI / 2 + gapAngle / 2; // Start after gap
    const backgroundEndAngle = startAngle + (2 * Math.PI - gapAngle); // End before gap
    
    // Outer circle - Download (blue)
    // Background
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, outerRadius, startAngle, backgroundEndAngle);
    cr.stroke();
    
    // Progress
    const maxAngle = 2 * Math.PI - gapAngle;
    const downloadProgressAngle = maxAngle * this.networkDownloadSpeed / 100;
    const downloadEndAngle = startAngle + downloadProgressAngle;
    cr.setSourceRGBA(0.2, 0.4, 0.8, 1); // Blue for download
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, outerRadius, startAngle, downloadEndAngle);
    cr.stroke();
    
    // Inner circle - Upload (green)
    // Background
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, innerRadius, startAngle, backgroundEndAngle);
    cr.stroke();
    
    // Progress
    const uploadProgressAngle = maxAngle * this.networkUploadSpeed / 100;
    const uploadEndAngle = startAngle + uploadProgressAngle;
    cr.setSourceRGBA(0.2, 0.7, 0.3, 1); // Green for upload
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, innerRadius, startAngle, uploadEndAngle);
    cr.stroke();
  }

  private updateData(): void {
    this.updateCPU();
    this.updateMemory();
    this.updateDisk();
    this.updateNetwork();
    this.updateCpuTemperature();
    this.updateGpuTemperature();
    this.updateSystemLoad();
    this.updateTopProcesses();
    this.updateSystemInfo();
  }

  private prevIdle: number = 0;
  private prevTotal: number = 0;

  private updateCPU(): void {
    try {
      // Get CPU usage from /proc/stat
      const [stdout] = this.utils.executeCommand('cat', ['/proc/stat']);
      const lines = stdout.split('\n');
      const cpuLine = lines.find(line => line.startsWith('cpu '));
      
      if (cpuLine) {
        const values = cpuLine.split(/\s+/).slice(1).map(v => parseInt(v));
        const idle = values[3] + values[4]; // idle + iowait
        const total = values.reduce((a, b) => a + b, 0);
        
        if (this.prevTotal !== 0) {
          const diffIdle = idle - this.prevIdle;
          const diffTotal = total - this.prevTotal;
          const usage = diffTotal > 0 ? Math.round(((diffTotal - diffIdle) / diffTotal) * 100) : 0;
          this.cpuUsage = usage;
          this.cpuLabel.set_label(`${usage}%`);
          this.cpuChart.queue_draw();
        }
        
        this.prevIdle = idle;
        this.prevTotal = total;
      }
    } catch (e) {
      console.error('Error updating CPU:', e);
      this.cpuLabel.set_label('N/A');
    }
  }

  private updateMemory(): void {
    try {
      const [stdout] = this.utils.executeCommand('free', ['-m']);
      const lines = stdout.split('\n');
      const memLine = lines.find(line => line.startsWith('Mem:'));
      
      if (memLine) {
        const values = memLine.split(/\s+/);
        const total = parseInt(values[1]);
        const used = parseInt(values[2]);
        const percentage = Math.round((used / total) * 100);
        this.memoryUsage = percentage;
        this.memoryLabel.set_label(`${percentage}%`);
        this.memoryChart.queue_draw();
      }
    } catch (e) {
      console.error('Error updating memory:', e);
      this.memoryLabel.set_label('N/A');
    }
  }

  private updateDisk(): void {
    try {
      const [stdout] = this.utils.executeCommand('df', ['-h', '/']);
      const lines = stdout.split('\n');
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/);
        if (parts.length >= 5) {
          const usePercent = parts[4].replace('%', '');
          this.diskUsage = parseInt(usePercent) || 0;
          this.diskLabel.set_label(`${this.diskUsage}%`);
          this.diskChart.queue_draw();
        }
      }
    } catch (e) {
      console.error('Error updating disk:', e);
      this.diskLabel.set_label('N/A');
    }
  }

  private prevRxBytes: number = 0;
  private prevTxBytes: number = 0;

  private updateNetwork(): void {
    try {
      const [stdout] = this.utils.executeCommand('cat', ['/proc/net/dev']);
      const lines = stdout.split('\n').slice(2);
      
      let totalRxBytes = 0;
      let totalTxBytes = 0;
      
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        
        const iface = parts[0].replace(':', '');
        if (iface === 'lo') continue;
        
        totalRxBytes += parseInt(parts[1]) || 0;
        totalTxBytes += parseInt(parts[9]) || 0;
      }
      
      if (this.prevRxBytes !== 0) {
        const rxDelta = totalRxBytes - this.prevRxBytes;
        const txDelta = totalTxBytes - this.prevTxBytes;
        
        // Convert to Mbps (delta is over 10 seconds)
        const downloadMbps = (rxDelta * 8) / (10 * 1000000);
        const uploadMbps = (txDelta * 8) / (10 * 1000000);
        const totalMbps = downloadMbps + uploadMbps;
        
        // Normalize to 0-100 scale (assuming 100 Mbps is 100%)
        this.networkDownloadSpeed = Math.min(downloadMbps, 100);
        this.networkUploadSpeed = Math.min(uploadMbps, 100);
        
        // Format label with both speeds
        let downloadStr = '';
        let uploadStr = '';
        
        if (downloadMbps < 1) {
          downloadStr = `${(downloadMbps * 1000).toFixed(0)} Kbps`;
        } else {
          downloadStr = `${downloadMbps.toFixed(1)} Mbps`;
        }
        
        if (uploadMbps < 1) {
          uploadStr = `${(uploadMbps * 1000).toFixed(0)} Kbps`;
        } else {
          uploadStr = `${uploadMbps.toFixed(1)} Mbps`;
        }
        
        this.networkLabel.set_label(`↓ ${downloadStr}\n↑ ${uploadStr}`);
        this.networkChart.queue_draw();
      }
      
      this.prevRxBytes = totalRxBytes;
      this.prevTxBytes = totalTxBytes;
    } catch (e) {
      console.error('Error updating network:', e);
      this.networkLabel.set_label('N/A');
    }
  }

  private updateTopProcesses(): void {
    try {
      // Clear existing rows
      let child = this.topProcessesList.get_first_child();
      while (child) {
        const next = child.get_next_sibling();
        this.topProcessesList.remove(child);
        child = next;
      }
      
      // Get top 5 processes by CPU usage, excluding ps command
      const [stdout] = this.utils.executeCommand('ps', ['axo', 'comm,%cpu', '--sort=-%cpu']);
      const lines = stdout.trim().split('\n').slice(1); // Skip header
      
      const numCores = this.getNumCores();
      let processCount = 0;
      
      for (let i = 0; i < lines.length && processCount < 5; i++) {
        const line = lines[i].trim();
        const match = line.match(/^(.+?)\s+([\d.]+)$/);
        
        if (match) {
          const name = match[1];
          
          // Skip ps command
          if (name === 'ps') {
            continue;
          }
          
          const cpuPercent = (parseFloat(match[2]) / numCores).toFixed(1);
          
          // Create row with horizontal box
          const row = new Gtk.ListBoxRow();
          const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 6,
          });
          
          const nameLabel = new Gtk.Label({
            label: name,
            halign: Gtk.Align.START,
            hexpand: true,
            ellipsize: 3, // ELLIPSIZE_END
          });
          
          const cpuLabel = new Gtk.Label({
            label: `${cpuPercent}%`,
            css_classes: ['dim-label', 'monospace'],
            halign: Gtk.Align.END,
          });
          
          box.append(nameLabel);
          box.append(cpuLabel);
          row.set_child(box);
          
          this.topProcessesList.append(row);
          processCount++;
        }
      }
    } catch (e) {
      console.error('Error updating top processes:', e);
    }
  }

  private getNumCores(): number {
    try {
      const [stdout] = this.utils.executeCommand('nproc', []);
      return parseInt(stdout.trim()) || 1;
    } catch {
      return 1;
    }
  }

  private updateSystemInfo(): void {
    try {
      // Clear existing rows
      let child = this.systemInfoList.get_first_child();
      while (child) {
        const next = child.get_next_sibling();
        this.systemInfoList.remove(child);
        child = next;
      }
      
      // OS Information
      const [osRelease] = this.utils.executeCommand('lsb_release', ['-ds']);
      const [kernelVersion] = this.utils.executeCommand('uname', ['-r']);
      
      // Desktop Environment
      const desktopEnv = GLib.getenv('XDG_CURRENT_DESKTOP') || 'Unknown';
      
      // Memory
      const [memInfo] = this.utils.executeCommand('free', ['-h']);
      const memLine = memInfo.split('\n').find(line => line.startsWith('Mem:'));
      let totalMem = 'Unknown';
      if (memLine) {
        const values = memLine.split(/\s+/);
        totalMem = values[1];
      }
      
      // CPU Model
      const [cpuInfo] = this.utils.executeCommand('cat', ['/proc/cpuinfo']);
      const cpuModelLine = cpuInfo.split('\n').find(line => line.includes('model name'));
      let cpuModel = 'Unknown';
      if (cpuModelLine) {
        cpuModel = cpuModelLine.split(':')[1].trim();
      }
      
      // Hostname
      const [hostname] = this.utils.executeCommand('hostname', []);
      
      // Uptime
      const [uptimeInfo] = this.utils.executeCommand('uptime', ['-p']);
      const uptime = uptimeInfo.trim().replace('up ', '');
      
      const os = osRelease.trim() || 'Linux';
      const kernel = kernelVersion.trim();
      const desktop = desktopEnv;
      const host = hostname.trim();
      
      // Create AdwActionRow for each info item
      const infoItems = [
        { title: 'Hostname', value: host },
        { title: 'Operating System', value: os },
        { title: 'Kernel Version', value: kernel },
        { title: 'Desktop Environment', value: desktop },
        { title: 'Processor', value: cpuModel },
        { title: 'Memory', value: totalMem },
        { title: 'Uptime', value: uptime },
      ];
      
      for (const item of infoItems) {
        const row = new Adw.ActionRow({
          title: item.title,
          subtitle: item.value,
        });
        this.systemInfoList.append(row);
      }
    } catch (e) {
      console.error('Error updating system info:', e);
    }
  }

  private drawTemperatureChart(cr: any, width: number, height: number, temperature: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    const lineWidth = 12;
    
    // Gap at bottom (in radians)
    const gapAngle = Math.PI / 2.5; // 70 degrees gap at bottom
    const startAngle = Math.PI / 2 + gapAngle / 2; // Start after gap
    const backgroundEndAngle = startAngle + (2 * Math.PI - gapAngle); // End before gap
    
    // Background arc (open at bottom)
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, radius, startAngle, backgroundEndAngle);
    cr.stroke();
    
    // Progress arc (temperature scale from 0 to 100°C)
    const maxTemp = 100;
    const percentage = Math.min((temperature / maxTemp) * 100, 100);
    const maxAngle = 2 * Math.PI - gapAngle;
    const progressAngle = maxAngle * percentage / 100;
    const endAngle = startAngle + progressAngle;
    
    // Color gradient based on temperature
    if (temperature < 50) {
      cr.setSourceRGBA(0.2, 0.7, 0.3, 1); // Green (cool)
    } else if (temperature < 70) {
      cr.setSourceRGBA(0.9, 0.7, 0.1, 1); // Yellow (warm)
    } else {
      cr.setSourceRGBA(0.9, 0.2, 0.2, 1); // Red (hot)
    }
    
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, radius, startAngle, endAngle);
    cr.stroke();
  }

  private updateCpuTemperature(): void {
    try {
      // Try to get CPU temperature from thermal zones
      const [thermalData] = this.utils.executeCommand('cat', ['/sys/class/thermal/thermal_zone0/temp']);
      if (thermalData) {
        const tempMilliC = parseInt(thermalData.trim());
        if (!isNaN(tempMilliC)) {
          this.cpuTemp = Math.round(tempMilliC / 1000);
          this.cpuTempLabel.set_label(`${this.cpuTemp}°C`);
          this.cpuTempChart.queue_draw();
          return;
        }
      }
    } catch (e) {
      // Fallback to sensors command
      try {
        const [sensorsOut] = this.utils.executeCommand('sensors', []);
        const tempMatch = sensorsOut.match(/Core 0:\s+\+(\d+\.\d+)/);
        if (tempMatch) {
          this.cpuTemp = Math.round(parseFloat(tempMatch[1]));
          this.cpuTempLabel.set_label(`${this.cpuTemp}°C`);
          this.cpuTempChart.queue_draw();
          return;
        }
      } catch (e2) {
        console.error('Error reading CPU temperature:', e2);
      }
    }
    
    this.cpuTempLabel.set_label('N/A');
  }

  private updateGpuTemperature(): void {
    try {
      // Try nvidia-smi for NVIDIA GPUs
      const [nvidiaOut] = this.utils.executeCommand('nvidia-smi', ['--query-gpu=temperature.gpu', '--format=csv,noheader']);
      const temp = parseInt(nvidiaOut.trim());
      if (!isNaN(temp)) {
        this.gpuTemp = temp;
        this.gpuTempLabel.set_label(`${this.gpuTemp}°C`);
        this.gpuTempChart.queue_draw();
        return;
      }
    } catch (e) {
      // Fallback to sensors for AMD or integrated GPUs
      try {
        const [sensorsOut] = this.utils.executeCommand('sensors', []);
        const tempMatch = sensorsOut.match(/edge:\s+\+(\d+\.\d+)/);
        if (tempMatch) {
          this.gpuTemp = Math.round(parseFloat(tempMatch[1]));
          this.gpuTempLabel.set_label(`${this.gpuTemp}°C`);
          this.gpuTempChart.queue_draw();
          return;
        }
      } catch (e2) {
        console.error('Error reading GPU temperature:', e2);
      }
    }
    
    this.gpuTempLabel.set_label('N/A');
  }

  private updateSystemLoad(): void {
    try {
      const [loadavg] = this.utils.executeCommand('cat', ['/proc/loadavg']);
      const loads = loadavg.trim().split(/\s+/);
      
      if (loads.length >= 3) {
        const load1 = parseFloat(loads[0]);
        const load5 = parseFloat(loads[1]);
        const load15 = parseFloat(loads[2]);
        
        this.load1minLabel.set_label(loads[0]);
        this.load5minLabel.set_label(loads[1]);
        this.load15minLabel.set_label(loads[2]);
        
        this.load1minBar.set_value(load1);
        this.load5minBar.set_value(load5);
        this.load15minBar.set_value(load15);
      }
    } catch (e) {
      console.error('Error updating system load:', e);
      this.load1minLabel.set_label('N/A');
      this.load5minLabel.set_label('N/A');
      this.load15minLabel.set_label('N/A');
    }
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }

  private setupUpdateInterval(): void {
    // Remove existing timeout
    if (this.updateTimeoutId !== null) {
      GLib.source_remove(this.updateTimeoutId);
      this.updateTimeoutId = null;
    }
    
    // Setup new timeout with interval from settings (in milliseconds)
    const intervalSeconds = this.settings.getRefreshInterval();
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalSeconds * 1000, () => {
      this.updateData();
      return GLib.SOURCE_CONTINUE;
    });
  }

  public destroy(): void {
    if (this.updateTimeoutId !== null) {
      GLib.source_remove(this.updateTimeoutId);
      this.updateTimeoutId = null;
    }
    
    if (this.settingsHandlerId !== null) {
      this.settings.disconnect(this.settingsHandlerId);
      this.settingsHandlerId = null;
    }
  }
}
