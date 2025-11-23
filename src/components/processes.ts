import Gtk from '@girs/gtk-4.0';
import Gdk from '@girs/gdk-4.0';
import Gio from '@girs/gio-2.0';
import GLib from '@girs/glib-2.0';
import Pango from '@girs/pango-1.0';
import { UtilsService } from '../services/utils-service';

interface ProcessInfo {
  name: string;
  pid: string;
  cpu: number;
  memory: number;
  memoryKB: number;
}

export class ProcessesComponent {
  private container: Gtk.Box;
  private listBox!: Gtk.ListBox;
  private processes: ProcessInfo[] = [];
  private sortColumn: string = '';
  private sortAscending: boolean = false;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private headerButtons: Map<string, Gtk.Button> = new Map();
  private totalCpuLabel!: Gtk.Label;
  private totalMemoryLabel!: Gtk.Label;

  constructor() {
    this.utils = UtilsService.instance;
    
    // Create container
    this.container = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
    });
    
    // Header row with sorting buttons
    const headerBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 0,
      margin_start: 6,
      margin_end: 6,
      margin_bottom: 3,
    });
    headerBox.add_css_class('toolbar');
    
    const nameHeader = this.createHeaderButton('Name', 'name');
    nameHeader.set_hexpand(true);
    headerBox.append(nameHeader);
    
    const pidHeader = this.createHeaderButton('PID', 'pid');
    pidHeader.set_size_request(100, -1);
    headerBox.append(pidHeader);
    
    const cpuHeader = this.createHeaderButton('CPU', 'cpu');
    cpuHeader.set_size_request(100, -1);
    headerBox.append(cpuHeader);
    
    const memHeader = this.createHeaderButton('Memory', 'memory');
    memHeader.set_size_request(120, -1);
    headerBox.append(memHeader);
    
    this.container.append(headerBox);
    
    // Create list box for processes
    this.listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    this.listBox.add_css_class('boxed-list');
    
    // Scrolled window - vexpand to fill available space
    const scrolled = new Gtk.ScrolledWindow({
      vexpand: true,
      hexpand: true,
    });
    scrolled.set_child(this.listBox);
    this.container.append(scrolled);
    
    // Bottom panel with totals in a card
    const totalsCard = new Gtk.Frame({
      margin_top: 12,
      vexpand: false,
    });
    totalsCard.add_css_class('view');
    
    const bottomPanel = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 24,
      margin_start: 12,
      margin_end: 12,
      margin_top: 12,
      margin_bottom: 12,
      halign: Gtk.Align.CENTER,
      vexpand: false,
    });
    
    const cpuTotalBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
    });
    const cpuIcon = new Gtk.Image({
      icon_name: 'drive-harddisk-solidstate-symbolic',
      pixel_size: 16,
    });
    cpuTotalBox.append(cpuIcon);
    this.totalCpuLabel = new Gtk.Label({
      label: 'Total CPU: 0.0%',
    });
    cpuTotalBox.append(this.totalCpuLabel);
    bottomPanel.append(cpuTotalBox);
    
    const memTotalBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
    });
    const memIcon = new Gtk.Image({
      icon_name: 'auth-sim-symbolic',
      pixel_size: 16,
    });
    memTotalBox.append(memIcon);
    this.totalMemoryLabel = new Gtk.Label({
      label: 'Total Memory: 0 MB',
    });
    memTotalBox.append(this.totalMemoryLabel);
    bottomPanel.append(memTotalBox);
    
    totalsCard.set_child(bottomPanel);
    this.container.append(totalsCard);
    
    // Load initial data
    this.loadProcesses();
    
    // Update every 10 seconds
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
      this.loadProcesses();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private createHeaderButton(label: string, column: string): Gtk.Button {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      halign: Gtk.Align.CENTER,
    });
    
    const labelWidget = new Gtk.Label({
      label: label,
    });
    box.append(labelWidget);
    
    const icon = new Gtk.Image({
      icon_name: 'pan-down-symbolic',
      visible: column === this.sortColumn,
    });
    box.append(icon);
    
    const button = new Gtk.Button();
    button.set_child(box);
    button.add_css_class('flat');
    
    button.connect('clicked', () => {
      if (this.sortColumn === column) {
        this.sortAscending = !this.sortAscending;
      } else {
        this.sortColumn = column;
        this.sortAscending = true;
      }
      this.updateHeaderIcons();
      this.displayProcesses();
    });
    
    this.headerButtons.set(column, button);
    return button;
  }
  
  private updateHeaderIcons(): void {
    this.headerButtons.forEach((button, column) => {
      const box = button.get_child() as Gtk.Box;
      const icon = box.get_last_child() as Gtk.Image;
      
      if (column === this.sortColumn) {
        icon.set_visible(true);
        icon.set_from_icon_name(this.sortAscending ? 'pan-up-symbolic' : 'pan-down-symbolic');
      } else {
        icon.set_visible(false);
      }
    });
  }

  private loadProcesses(): void {
    try {
      // Get number of CPU cores
      const [coresOutput] = this.utils.executeCommand('nproc', []);
      const numCores = parseInt(coresOutput.trim()) || 1;
      
      // Only show processes from current user, get full command with args
      // Use rss (resident set size) to get memory in KB
      const [stdout] = this.utils.executeCommand('ps', ['xo', 'pid,%cpu,%mem,rss,args', '--sort=-%cpu', '--no-headers']);
      const lines = stdout.trim().split('\n');
      
      this.processes = [];
      
      // Parse all non-kernel user processes
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Split into 5 parts: PID, CPU%, MEM%, RSS(KB), full command
        const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
        
        if (match) {
          const pid = match[1];
          // Normalize CPU percentage by number of cores (ps shows total across all cores)
          const cpu = (parseFloat(match[2]) || 0) / numCores;
          const memory = parseFloat(match[3]) || 0;
          const memoryKB = parseInt(match[4]) || 0;
          const fullCommand = match[5].trim();
          
          // Skip kernel threads (commands in brackets)
          if (fullCommand.startsWith('[') && fullCommand.includes(']')) {
            continue;
          }
          
          // Extract clean process name from command
          let name = fullCommand;
          const firstArg = fullCommand.split(' ')[0];
          
          if (firstArg.includes('/')) {
            // Extract filename from path
            name = firstArg.substring(firstArg.lastIndexOf('/') + 1);
          } else {
            name = firstArg;
          }
          
          // Skip ps command itself (check both name and full command)
          if (name === 'ps' || fullCommand.startsWith('ps ') || fullCommand === 'ps') {
            continue;
          }
          
          // Limit length
          if (name.length > 40) {
            name = name.substring(0, 37) + '...';
          }
          
          this.processes.push({
            name,
            pid,
            cpu,
            memory,
            memoryKB
          });
        }
      }
      this.displayProcesses();
      this.updateTotals();
    } catch (e) {
      console.error('Error loading processes:', e);
    }
  }

  private updateTotals(): void {
    let totalCpu = 0;
    let totalMemoryKB = 0;
    
    for (const process of this.processes) {
      totalCpu += process.cpu;
      totalMemoryKB += process.memoryKB;
    }
    
    // Cap total CPU at 100% and show as percentage of total capacity
    const cappedCpu = Math.min(totalCpu, 100);
    this.totalCpuLabel.set_label(`Total CPU: ${cappedCpu.toFixed(1)}%`);
    
    // Format total memory
    let memoryText = '';
    if (totalMemoryKB >= 1024 * 1024) {
      memoryText = `${(totalMemoryKB / (1024 * 1024)).toFixed(1)} GB`;
    } else if (totalMemoryKB >= 1024) {
      memoryText = `${(totalMemoryKB / 1024).toFixed(1)} MB`;
    } else {
      memoryText = `${totalMemoryKB.toFixed(0)} KB`;
    }
    this.totalMemoryLabel.set_label(`Total Memory: ${memoryText}`);
  }

  private displayProcesses(): void {
    // Sort processes only if a sort column is selected
    if (this.sortColumn) {
      this.processes.sort((a, b) => {
        let valueA: any;
        let valueB: any;
        
        // For memory, sort by memoryKB instead of percentage
        if (this.sortColumn === 'memory') {
          valueA = a.memoryKB;
          valueB = b.memoryKB;
        } else {
          valueA = a[this.sortColumn as keyof ProcessInfo];
          valueB = b[this.sortColumn as keyof ProcessInfo];
          
          // Handle string sorting (name)
          if (this.sortColumn === 'name') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
          }
          // Handle numeric sorting for PID
          else if (this.sortColumn === 'pid') {
            valueA = parseInt(valueA);
            valueB = parseInt(valueB);
          }
        }
        
        if (valueA < valueB) return this.sortAscending ? -1 : 1;
        if (valueA > valueB) return this.sortAscending ? 1 : -1;
        return 0;
      });
    }
    
    
    // Clear current list
    while (this.listBox.get_first_child()) {
      const child = this.listBox.get_first_child();
      if (child) {
        this.listBox.remove(child);
      }
    }
    
    // Add processes to list
    for (const process of this.processes) {
      const row = this.createProcessRow(process);
      this.listBox.append(row);
    }
  }

  private formatMemory(kb: number): string {
    if (kb >= 1024 * 1024) {
      return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
    } else if (kb >= 1024) {
      return `${(kb / 1024).toFixed(1)} MB`;
    } else {
      return `${kb.toFixed(0)} KB`;
    }
  }

  private getIconForProcess(processName: string): string | null {
    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!);
    
    // Search in desktop files for matching process
    const desktopDirs = [
      '/usr/share/applications',
      `${GLib.get_home_dir()}/.local/share/applications`
    ];
    
    for (const dir of desktopDirs) {
      const dirFile = Gio.File.new_for_path(dir);
      if (dirFile.query_exists(null)) {
        try {
          const enumerator = dirFile.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
          let fileInfo;
          
          while ((fileInfo = enumerator.next_file(null)) !== null) {
            const fileName = fileInfo.get_name();
            if (fileName.endsWith('.desktop')) {
              
              const desktopFile = dirFile.get_child(fileName);
              const [success, contents] = desktopFile.load_contents(null);
              
              if (success) {
                const text = new TextDecoder().decode(contents);
                const lines = text.split('\n');
                
                let execLine = '';
                let iconLine = '';
                
                for (const line of lines) {
                  if (line.startsWith('Exec=')) {
                    execLine = line.substring(5);
                  } else if (line.startsWith('Icon=')) {
                    iconLine = line.substring(5);
                  }
                }
                
                // Check if the Exec line contains our process name
                if (execLine && iconLine) {
                  const execLower = execLine.toLowerCase();
                  const processLower = processName.toLowerCase();
                  
                  // Match if process name appears in the exec path or command
                  if (execLower.includes(`/${processLower}`) || 
                      execLower.includes(` ${processLower} `) ||
                      execLower.startsWith(`${processLower} `)) {
                    
                    // Verify icon exists in theme
                    if (iconTheme.has_icon(iconLine)) {
                      return iconLine;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Continue to next directory
        }
      }
    }
    
    return null;
  }

  private createProcessRow(process: ProcessInfo): Gtk.ListBoxRow {
    const row = new Gtk.ListBoxRow();
    
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 0,
      margin_start: 12,
      margin_end: 12,
      margin_top: 6,
      margin_bottom: 6,
    });
    
    // Try to get icon from desktop files, fallback to generic
    const iconName = this.getIconForProcess(process.name) || 'application-x-executable';
    
    const icon = new Gtk.Image({
      icon_name: iconName,
      pixel_size: 24,
      margin_end: 8,
    });
    box.append(icon);
    
    const nameLabel = new Gtk.Label({
      label: process.name,
      halign: Gtk.Align.START,
      hexpand: true,
      ellipsize: Pango.EllipsizeMode.END,
    });
    box.append(nameLabel);
    
    const pidLabel = new Gtk.Label({
      label: process.pid,
      halign: Gtk.Align.END,
      xalign: 1.0,
    });
    pidLabel.set_size_request(100, -1);
    box.append(pidLabel);
    
    const cpuLabel = new Gtk.Label({
      label: `${process.cpu.toFixed(1)}%`,
      halign: Gtk.Align.END,
      xalign: 1.0,
    });
    cpuLabel.set_size_request(100, -1);
    box.append(cpuLabel);
    
    const memLabel = new Gtk.Label({
      label: this.formatMemory(process.memoryKB),
      halign: Gtk.Align.END,
      xalign: 1.0,
    });
    memLabel.set_size_request(120, -1);
    box.append(memLabel);
    
    row.set_child(box);
    return row;
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
