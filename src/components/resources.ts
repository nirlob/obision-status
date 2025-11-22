import Gtk from '@girs/gtk-4.0';

export class ResourcesComponent {
  private container: Gtk.Box;

  constructor() {
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/resources.ui');
      } catch (e) {
        builder.add_from_file('data/ui/resources.ui');
      }
    } catch (e) {
      console.error('Could not load resources.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('resources_container') as Gtk.Box;
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }
}
