# Obision Status - AI Agent Instructions

## Project Overview
A GNOME system status application built with TypeScript, GTK4, and Libadwaita. Displays system information using a responsive navigation split-view layout. Uses a hybrid build system: TypeScript → GJS-compatible JavaScript via custom Node.js build script.

## Critical Build System
**DO NOT use `tsc` directly.** Use `npm run build` which:
1. Compiles TypeScript to CommonJS in `builddir/`
2. Strips CommonJS/TypeScript artifacts (`exports`, `require`, `__importDefault`)
3. Combines all modules into single `builddir/main.js` with GJS-compatible imports
4. Converts `@girs` imports to GJS `imports.gi` syntax (e.g., `import Gtk from "@girs/gtk-4.0"` → `const { Gtk } = imports.gi;`)
5. Copies resources (`data/ui/`, `data/style.css`, `data/icons/`) to `builddir/`

**Build concatenation order is critical**: `scripts/build.js` combines files in sequence (services → components → main) to prevent undefined references in the single-file output.

## Run Commands
- **Development**: `npm start` (builds + runs application)
- **Build only**: `npm run build` (compile TypeScript → GJS)
- **Direct run**: `./builddir/main.js` (after building)
- **Production install**: `npm run meson-install` (Meson compile + system-wide install, requires sudo)
- **Clean**: `npm run clean` (remove build artifacts)

## Architecture

### Application Structure
Single-file application (`src/main.ts`) with modular class design:
```typescript
class ObisionStatusApplication {
  private application: Adw.Application;
  
  constructor() {
    this.application = new Adw.Application({
      application_id: 'com.obision.ObisionStatus',
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });
    this.application.connect('activate', this.onActivate.bind(this));
    this.application.connect('startup', this.onStartup.bind(this));
  }
}
```

### Service Singletons
Services follow static instance pattern (`UtilsService.instance`). Example from `src/services/utils-service.ts`:
```typescript
export class UtilsService {
  static _instance: UtilsService;
  
  public static get instance(): UtilsService {
    if (!UtilsService._instance) {
      UtilsService._instance = new UtilsService();
    }
    return UtilsService._instance;
  }
  
  public executeCommand(command: string, args: string[] = []): [string, string] {
    // Uses Gio.Subprocess for shell commands
  }
}
```

### UI Loading Pattern
UI loaded from GTK Builder XML files with fallback paths:
```typescript
const builder = Gtk.Builder.new();
try {
  builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/main.ui'); // Installed path
} catch (e) {
  builder.add_from_file('data/ui/main.ui'); // Development path
}
const window = builder.get_object('application_window') as Adw.ApplicationWindow;
```

## File Structure
- **`src/main.ts`**: Application entry point, window creation, menu setup
- **`src/services/`**: Singleton services (UtilsService for system commands)
- **`src/components/`**: Reusable UI component classes (currently minimal)
- **`src/interfaces/`**: TypeScript type definitions
- **`data/ui/main.ui`**: GTK Builder XML with `AdwNavigationSplitView` layout
- **`data/style.css`**: GTK4/Adwaita CSS customizations
- **`scripts/build.js`**: Custom TypeScript-to-GJS compiler

## GJS/GTK4 Integration

### Import Conversion
TypeScript uses `@girs` packages, build script converts to GJS runtime format:
- **TypeScript**: `import Gtk from "@girs/gtk-4.0"`
- **Built output**: `const { Gtk } = imports.gi;`

Build script header template (`scripts/build.js`):
```javascript
const gjsHeader = `#!/usr/bin/env gjs

const { Gio } = imports.gi;
const { Gtk } = imports.gi;
const { Gdk } = imports.gi;
const { Adw } = imports.gi;
const { GLib } = imports.gi;
const { Pango } = imports.gi;

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';
`;
```

### Adwaita Patterns
Modern GNOME 45+ UI uses:
- **`AdwNavigationSplitView`**: Responsive sidebar/content layout with adaptive breakpoints
- **`AdwBreakpoint`**: Collapse sidebar at narrow widths (`max-width: 400sp`)
- **`AdwToolbarView`**: Header bar + content container
- **`AdwToastOverlay`**: In-app notifications
- **`AdwAboutWindow`**: Standard GNOME about dialog

### CSS Loading
Load custom styles early in activation:
```typescript
const cssProvider = new Gtk.CssProvider();
try {
  cssProvider.load_from_path('/usr/share/com.obision.ObisionStatus/style.css');
} catch (e) {
  cssProvider.load_from_path('data/style.css'); // Development fallback
}
const display = Gdk.Display.get_default();
Gtk.StyleContext.add_provider_for_display(display, cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
```

## TypeScript/GJS Gotchas
- **Window content property**: Adw.ApplicationWindow requires type cast: `(window as any).content = widget`
- **CommonJS required**: tsconfig uses `"module": "CommonJS"` (ES modules unsupported by build script)
- **Type definitions**: `@girs/*` packages provide IntelliSense, but GJS uses different runtime imports
- **Main entry point**: Use global `ARGV` variable: `if (typeof ARGV !== 'undefined') main(ARGV);`
- **Builder object retrieval**: Cast types explicitly: `builder.get_object('id') as Adw.ApplicationWindow`

## Development Workflow
1. Edit TypeScript in `src/` or UI XML in `data/ui/`
2. Run `npm run build` to compile (automatic on `npm start`)
3. Test with `./builddir/main.js` or `npm start`
4. For system install: `npm run meson-install` (requires sudo)
5. Update desktop database: `sudo update-desktop-database /usr/share/applications`

## Meson Build System
`meson.build` handles production installation:
- Installs compiled JS from `builddir/main.js` (not `src/`)
- Creates launcher script in `/usr/bin/` from `bin/obision-status.in`
- Compiles GResources bundle from `data/*.gresource.xml`
- Installs desktop file, icons, GSettings schema
- Uses app ID `com.obision.ObisionStatus`

**Install paths**:
- Binary: `/usr/bin/obision-status` → `/usr/share/com.obision.ObisionStatus/main.js`
- UI: `/usr/share/com.obision.ObisionStatus/ui/`
- Icons: `/usr/share/icons/hicolor/{scalable,48x48,64x64}/apps/`

## Common Tasks

### Adding App Actions
Register in `onStartup()` method:
```typescript
const myAction = new Gio.SimpleAction({ name: 'my-action' });
myAction.connect('activate', () => { /* handler */ });
this.application.add_action(myAction);
this.application.set_accels_for_action('app.my-action', ['<Ctrl>M']); // Keyboard shortcut
```

### Accessing UI Elements
Use builder IDs from `data/ui/main.ui`:
```typescript
const mainContent = builder.get_object('main_content') as Gtk.Box;
const splitView = builder.get_object('split_view') as Adw.NavigationSplitView;
```

### System Commands
Use `UtilsService` for shell execution:
```typescript
const utils = UtilsService.instance;
const [stdout, stderr] = utils.executeCommand('df', ['-h']); // Disk usage example
```
