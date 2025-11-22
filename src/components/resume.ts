import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

export class ResumeComponent {
  private container: Gtk.Box;
  private cpuLabel!: Gtk.Label;
  private memoryLabel!: Gtk.Label;
  private cpuChart!: Gtk.DrawingArea;
  private memoryChart!: Gtk.DrawingArea;
  private systemInfoLabel!: Gtk.Label;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private cpuUsage: number = 0;
  private memoryUsage: number = 0;

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/resume.ui');
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
    this.memoryLabel = builder.get_object('memory_value') as Gtk.Label;
    this.cpuChart = builder.get_object('cpu_chart') as Gtk.DrawingArea;
    this.memoryChart = builder.get_object('memory_chart') as Gtk.DrawingArea;
    this.systemInfoLabel = builder.get_object('system_info_value') as Gtk.Label;
    
    // Setup drawing functions
    this.cpuChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.cpuUsage);
    });
    
    this.memoryChart.set_draw_func((area, cr, width, height) => {
      this.drawCircularChart(cr, width, height, this.memoryUsage);
    });
    
    // Initial update
    this.updateData();
    
    // Update every 10 seconds
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
      this.updateData();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private drawCircularChart(cr: any, width: number, height: number, percentage: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    const lineWidth = 12;
    
    // Background circle
    cr.setSourceRGBA(0.3, 0.3, 0.3, 0.2);
    cr.setLineWidth(lineWidth);
    cr.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    cr.stroke();
    
    // Progress arc
    const startAngle = -Math.PI / 2; // Start at top
    const endAngle = startAngle + (2 * Math.PI * percentage / 100);
    
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

  private updateData(): void {
    this.updateCPU();
    this.updateMemory();
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

  private updateSystemInfo(): void {
    try {
      const [osRelease] = this.utils.executeCommand('lsb_release', ['-ds']);
      const [desktopEnv] = this.utils.executeCommand('echo', ['$XDG_CURRENT_DESKTOP']);
      const [memInfo] = this.utils.executeCommand('free', ['-h']);
      
      const memLine = memInfo.split('\n').find(line => line.startsWith('Mem:'));
      let totalMem = 'Unknown';
      if (memLine) {
        const values = memLine.split(/\s+/);
        totalMem = values[1];
      }
      
      const os = osRelease.trim() || 'Linux';
      const desktop = desktopEnv.trim() || 'GNOME';
      
      this.systemInfoLabel.set_label(`${os} • ${desktop} • ${totalMem} RAM`);
    } catch (e) {
      console.error('Error updating system info:', e);
      this.systemInfoLabel.set_label('System information unavailable');
    }
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }

  public destroy(): void {
    if (this.updateTimeoutId !== null) {
      GLib.source_remove(this.updateTimeoutId);
      this.updateTimeoutId = null;
    }
  }
}
