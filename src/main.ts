import Gio from '@girs/gio-2.0';
import Gtk from '@girs/gtk-4.0';
import Gdk from '@girs/gdk-4.0';
import Adw from '@girs/adw-1';
import { ResumeComponent } from './components/resume';
import { SystemInfoComponent } from './components/system-info';
import { ResourcesComponent } from './components/resources';
import { ProcessesComponent } from './components/processes';

class ObisionStatusApplication {
  private application: Adw.Application;

  constructor() {
    // Create the application
    this.application = new Adw.Application({
      application_id: 'com.obision.ObisionStatus',
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    // Connect signals
    this.application.connect('activate', this.onActivate.bind(this));
    this.application.connect('startup', this.onStartup.bind(this));
  }

  private onStartup(): void {
    console.log('Application starting up...');

    // Add application actions for menu
    const aboutAction = new Gio.SimpleAction({ name: 'about' });
    aboutAction.connect('activate', () => {
      const windows = this.application.get_windows();
      if (windows.length > 0) {
        this.showAboutDialog(windows[0]);
      }
    });
    this.application.add_action(aboutAction);

    const preferencesAction = new Gio.SimpleAction({ name: 'preferences' });
    preferencesAction.connect('activate', () => {
      console.log('Preferences action activated');
    });
    this.application.add_action(preferencesAction);

    const quitAction = new Gio.SimpleAction({ name: 'quit' });
    quitAction.connect('activate', () => {
      this.application.quit();
    });
    this.application.add_action(quitAction);

    // Set keyboard shortcuts
    this.application.set_accels_for_action('app.quit', ['<Ctrl>Q']);

    // Set resource path
    // this.application.set_resource_base_path('/data');
  }

  private onActivate(): void {
    console.log('Application activated');

    // Load CSS
    const cssProvider = new Gtk.CssProvider();
    try {
      cssProvider.load_from_path('/usr/share/com.obision.ObisionStatus/style.css');
    } catch (e) {
      cssProvider.load_from_path('data/style.css');
    }

    const display = Gdk.Display.get_default();
    if (display) {
      Gtk.StyleContext.add_provider_for_display(display, cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }

    // Create and show the main window
    const window = this.createMainWindow();
    console.log('Window created, presenting...');
    window.present();
  }

  private createMainWindow(): Adw.ApplicationWindow {
    // Load UI from resource
    const builder = Gtk.Builder.new();

    // Fallback: load from file
    try {
      // Try installed path first
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/main.ui');
      } catch (e) {
        builder.add_from_file('data/ui/main.ui');
      }
      console.log('Loaded UI from file');
    } catch (e2) {
      console.error('Could not load UI file:', e2);
      console.log('Using fallback UI');

      this.application.quit();
    }

    const window = builder.get_object('application_window') as Adw.ApplicationWindow;
    window.set_application(this.application);

    console.log('Setting up UI with loaded content');

    // Get UI elements
    const navigationList = builder.get_object('navigation_list') as Gtk.ListBox;
    const mainContent = builder.get_object('main_content') as Gtk.Box;

    // Setup navigation
    navigationList.connect('row-activated', (_listbox: Gtk.ListBox, row: Gtk.ListBoxRow) => {
      this.onNavigationItemSelected(row, mainContent);
    });

    // Select first item by default
    const firstRow = navigationList.get_row_at_index(0);
    if (firstRow) {
      navigationList.select_row(firstRow);
      this.onNavigationItemSelected(firstRow, mainContent);
    }

    return window;
  }

  private onNavigationItemSelected(row: Gtk.ListBoxRow, contentBox: Gtk.Box): void {
    // Clear current content
    let child = contentBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      contentBox.remove(child);
      child = next;
    }

    // Get row index
    const index = row.get_index();

    // Add content based on selection
    switch (index) {
      case 0: // Resume
        this.showResume(contentBox);
        break;
      case 1: // System Info
        this.showSystemInfo(contentBox);
        break;
      case 2: // Resources
        this.showResources(contentBox);
        break;
      case 3: // Processes
        this.showProcesses(contentBox);
        break;
    }
  }

  private showResume(contentBox: Gtk.Box): void {
    const component = new ResumeComponent();
    contentBox.append(component.getWidget());
  }

  private showSystemInfo(contentBox: Gtk.Box): void {
    const component = new SystemInfoComponent();
    contentBox.append(component.getWidget());
  }

  private showResources(contentBox: Gtk.Box): void {
    const component = new ResourcesComponent();
    contentBox.append(component.getWidget());
  }

  private showProcesses(contentBox: Gtk.Box): void {
    const component = new ProcessesComponent();
    contentBox.append(component.getWidget());
  }

  private showAboutDialog(parent: Gtk.Window): void {
    const aboutDialog = new Adw.AboutWindow({
      transient_for: parent,
      modal: true,
      application_name: 'Obision Status',
      application_icon: 'com.obision.ObisionStatus',
      developer_name: 'Jose Francisco Gonzalez',
      version: '1.0.0',
      developers: ['Jose Francisco Gonzalez <jfgs1609@gmail.com>'],
      copyright: `© ${new Date().getFullYear()} Jose Francisco Gonzalez`,
      license_type: Gtk.License.GPL_3_0,
      website: 'https://obision.com',
      issue_url: 'https://github.com/nirlob/obision-status/issues',
    });

    aboutDialog.present();
  }

  public run(argv: string[]): number {
    return this.application.run(argv);
  }
}

// Main function
function main(argv: string[]): number {
  const app = new ObisionStatusApplication();
  return app.run(argv);
}

// Run the application
if (typeof ARGV !== 'undefined') {
  main(ARGV);
} else {
  main([]);
}
