#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::SystemTray;
use tauri::{CustomMenuItem, SystemTrayMenu, SystemTrayMenuItem};

fn main() {

  let tray_menu = SystemTrayMenu::new()
  .add_item(CustomMenuItem::new("about".to_string(), "About"))
  .add_native_item(SystemTrayMenuItem::Separator)
  .add_item(CustomMenuItem::new("quit".to_string(), "Quit"));

  let tray = SystemTray::new().with_menu(tray_menu);

  tauri::Builder::default()
    .system_tray(tray)
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
