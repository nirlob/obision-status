import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import { UtilsService } from '../services/utils-service';

export class SystemInfoComponent {
  private container: Gtk.Box;
  private listBox: Gtk.ListBox;
  private utils: UtilsService;

  constructor() {
    this.utils = UtilsService.instance;
    
    // Create container
    this.container = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 12,
    });
    
    // Title
    const title = new Gtk.Label({
      label: 'System Information',
      halign: Gtk.Align.START,
    });
    title.add_css_class('title-1');
    this.container.append(title);
    
    // Create list box
    this.listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    this.listBox.add_css_class('boxed-list');
    
    // Scrolled window
    const scrolled = new Gtk.ScrolledWindow({
      vexpand: true,
      hexpand: true,
    });
    scrolled.set_child(this.listBox);
    this.container.append(scrolled);
    
    // Load system info
    this.loadSystemInfo();
  }

  private loadSystemInfo(): void {
    try {
      const [stdout] = this.utils.executeCommand('fastfetch', ['--format', 'json']);
      const data = JSON.parse(stdout);
      
      // Process each entry from fastfetch
      for (const item of data) {
        if (item.error || item.type === 'Separator' || item.type === 'Title') {
          continue;
        }
        
        const result = item.result;
        let title = '';
        let subtitle = '';
        let icon = '';
        
        switch (item.type) {
          case 'OS':
            title = 'OS';
            subtitle = result.prettyName || result.name;
            icon = 'computer-symbolic';
            break;
          case 'Host':
            title = 'Host';
            subtitle = result.name;
            icon = 'computer-symbolic';
            break;
          case 'Kernel':
            title = 'Kernel';
            subtitle = `${result.name} ${result.release}`;
            icon = 'emblem-system-symbolic';
            break;
          case 'Uptime':
            title = 'Uptime';
            subtitle = this.formatUptime(result.uptime);
            icon = 'clock-symbolic';
            break;
          case 'Packages':
            title = 'Packages';
            const packages = [];
            if (result.dpkg > 0) packages.push(`${result.dpkg} (dpkg)`);
            if (result.flatpakSystem > 0 || result.flatpakUser > 0) {
              packages.push(`${result.flatpakSystem + result.flatpakUser} (flatpak)`);
            }
            if (result.snap > 0) packages.push(`${result.snap} (snap)`);
            subtitle = packages.join(', ');
            icon = 'package-x-generic-symbolic';
            break;
          case 'Shell':
            title = 'Shell';
            subtitle = `${result.name} ${result.version}`;
            icon = 'utilities-terminal-symbolic';
            break;
          case 'Display':
            title = 'Display';
            subtitle = `${result.width}x${result.height} @ ${result.refreshRate} Hz`;
            icon = 'video-display-symbolic';
            break;
          case 'DE':
            title = 'Desktop Environment';
            subtitle = `${result.name} ${result.version}`;
            icon = 'preferences-desktop-symbolic';
            break;
          case 'WM':
            title = 'Window Manager';
            subtitle = `${result.pretty}`;
            icon = 'preferences-system-windows-symbolic';
            break;
          case 'Theme':
            title = 'Theme';
            subtitle = result.pretty || result.name;
            icon = 'preferences-desktop-theme-symbolic';
            break;
          case 'Icons':
            title = 'Icons';
            subtitle = result.pretty || result.name;
            icon = 'preferences-desktop-icons-symbolic';
            break;
          case 'Font':
            title = 'Font';
            subtitle = `${result.pretty}`;
            icon = 'font-x-generic-symbolic';
            break;
          case 'Cursor':
            title = 'Cursor';
            subtitle = `${result.name} (${result.size}px)`;
            icon = 'input-mouse-symbolic';
            break;
          case 'Terminal':
            title = 'Terminal';
            subtitle = `${result.exe} ${result.version}`;
            icon = 'utilities-terminal-symbolic';
            break;
          case 'CPU':
            title = 'CPU';
            subtitle = result.name;
            icon = 'cpu-symbolic';
            break;
          case 'GPU':
            title = `GPU ${result.index + 1}`;
            subtitle = `${result.name} ${result.type ? `[${result.type}]` : ''}`;
            icon = 'video-display-symbolic';
            break;
          case 'Memory':
            title = 'Memory';
            subtitle = `${this.formatBytes(result.used)} / ${this.formatBytes(result.total)} (${result.percentage.toFixed(1)}%)`;
            icon = 'memory-symbolic';
            break;
          case 'Swap':
            if (result.total > 0) {
              title = 'Swap';
              subtitle = `${this.formatBytes(result.used)} / ${this.formatBytes(result.total)} (${result.percentage.toFixed(1)}%)`;
              icon = 'drive-harddisk-symbolic';
            }
            break;
          case 'Disk':
            title = `Disk (${result.mountpoint})`;
            subtitle = `${this.formatBytes(result.used)} / ${this.formatBytes(result.total)} (${result.percentage.toFixed(1)}%) - ${result.filesystem}`;
            icon = 'drive-harddisk-symbolic';
            break;
          case 'LocalIP':
            title = `Local IP (${result.name})`;
            subtitle = result.ip;
            icon = 'network-wired-symbolic';
            break;
          case 'Battery':
            title = `Battery (${result.modelName})`;
            const status = result.status ? ` [${result.status}]` : '';
            subtitle = `${result.percentage.toFixed(1)}%${status}`;
            icon = result.status === 'AC Connected' ? 'battery-full-charging-symbolic' : 'battery-symbolic';
            break;
          case 'Locale':
            title = 'Locale';
            subtitle = result.result;
            icon = 'preferences-desktop-locale-symbolic';
            break;
          default:
            continue;
        }
        
        if (title && subtitle) {
          this.addInfoRow(title, subtitle, icon);
        }
      }
    } catch (e) {
      console.error('Error loading system info:', e);
      // Fallback if fastfetch fails
      this.addInfoRow('Error', 'Could not load system information', 'dialog-error-symbolic');
    }
  }

  private addInfoRow(title: string, subtitle: string, iconName: string): void {
    const row = new Adw.ActionRow({
      title: title,
      subtitle: subtitle,
    });
    
    if (iconName) {
      const icon = new Gtk.Image({
        icon_name: iconName,
        pixel_size: 16,
      });
      row.add_prefix(icon);
    }
    
    this.listBox.append(row);
  }

  private formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days} days`);
    if (hours > 0) parts.push(`${hours} hours`);
    if (mins > 0) parts.push(`${mins} mins`);
    
    return parts.join(', ') || '0 mins';
  }

  private formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KiB`;
    }
    return `${bytes} B`;
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }
}
