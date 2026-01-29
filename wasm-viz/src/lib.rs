//! Funding Platform Visualization Library
//!
//! High-performance WebAssembly visualizations for the funding application platform.
//! Optimized for rendering 1000+ applications smoothly using canvas-based rendering.

mod charts;

use wasm_bindgen::prelude::*;

pub use charts::*;

/// Initialize the WASM module with better error messages in debug builds
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Module version for cache busting
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Performance check - returns approximate render capability
#[wasm_bindgen]
pub fn benchmark_canvas(canvas_id: &str, iterations: u32) -> Result<f64, JsValue> {
    use web_sys::window;

    let window = window().ok_or("No window")?;
    let document = window.document().ok_or("No document")?;
    let canvas = document
        .get_element_by_id(canvas_id)
        .ok_or("Canvas not found")?
        .dyn_into::<web_sys::HtmlCanvasElement>()?;
    let ctx = canvas
        .get_context("2d")?
        .ok_or("No 2d context")?
        .dyn_into::<web_sys::CanvasRenderingContext2d>()?;

    let performance = window.performance().ok_or("No performance API")?;
    let start = performance.now();

    for i in 0..iterations {
        let x = (i % 100) as f64 * 5.0;
        let y = (i / 100) as f64 * 5.0;
        ctx.fill_rect(x, y, 4.0, 4.0);
    }

    let end = performance.now();
    Ok(end - start)
}
