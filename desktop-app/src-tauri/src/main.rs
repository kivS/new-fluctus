#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]


use tauri::{
  SystemTray, 
  CustomMenuItem, 
  SystemTrayMenu, 
  SystemTrayMenuItem, 
  SystemTrayEvent,
  WindowUrl,
  WindowBuilder
};


fn main() {

  let tray_menu = SystemTrayMenu::new()
  .add_item(CustomMenuItem::new("new_window".to_string(), "New Window"))
  .add_item(CustomMenuItem::new("about".to_string(), "About"))
  .add_native_item(SystemTrayMenuItem::Separator)
  .add_item(CustomMenuItem::new("quit".to_string(), "Quit"));

  let tray = SystemTray::new().with_menu(tray_menu);

  tauri::Builder::default()
    .system_tray(tray)
    .on_system_tray_event(|app, event| match event {
      SystemTrayEvent::MenuItemClick { id, .. } => {
        match id.as_str() {
          "quit" => {
            // std::process::exit(0);
            app.exit(0)
          }
          "about" => {
            println!("Fluctus is developed by Vik Borges");
          }
          "new_window" =>{
            println!("Creating a new window");
            app.create_window(
              "new",

              WindowUrl::App("youtube.html".into()),

              |window_builder, webview_attributes| {
                (window_builder.title("Hello!"), webview_attributes)
              }
            );
          }
          _ => {}
        }
      }
      _ => {}
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
