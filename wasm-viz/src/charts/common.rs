//! Common utilities for chart rendering

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

/// Color theme for visualizations
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ColorTheme {
    pub primary: String,
    pub secondary: String,
    pub success: String,
    pub warning: String,
    pub danger: String,
    pub background: String,
    pub text: String,
    pub grid: String,
    pub accent: Vec<String>,
}

impl Default for ColorTheme {
    fn default() -> Self {
        Self {
            primary: "#3B82F6".to_string(),     // Blue
            secondary: "#6B7280".to_string(),   // Gray
            success: "#10B981".to_string(),     // Green
            warning: "#F59E0B".to_string(),     // Amber
            danger: "#EF4444".to_string(),      // Red
            background: "#FFFFFF".to_string(),
            text: "#1F2937".to_string(),
            grid: "#E5E7EB".to_string(),
            accent: vec![
                "#3B82F6".to_string(),  // Blue
                "#10B981".to_string(),  // Green
                "#F59E0B".to_string(),  // Amber
                "#EF4444".to_string(),  // Red
                "#8B5CF6".to_string(),  // Purple
                "#EC4899".to_string(),  // Pink
                "#06B6D4".to_string(),  // Cyan
                "#84CC16".to_string(),  // Lime
            ],
        }
    }
}

#[wasm_bindgen]
pub fn create_default_theme() -> JsValue {
    serde_wasm_bindgen::to_value(&ColorTheme::default()).unwrap()
}

/// Padding configuration
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Padding {
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub left: f64,
}

impl Default for Padding {
    fn default() -> Self {
        Self {
            top: 40.0,
            right: 40.0,
            bottom: 60.0,
            left: 60.0,
        }
    }
}

/// Common chart configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChartConfig {
    pub width: f64,
    pub height: f64,
    pub padding: Padding,
    pub theme: ColorTheme,
    pub animate: bool,
    pub show_grid: bool,
    pub show_labels: bool,
    pub show_legend: bool,
    pub font_family: String,
    pub font_size: f64,
}

impl Default for ChartConfig {
    fn default() -> Self {
        Self {
            width: 800.0,
            height: 400.0,
            padding: Padding::default(),
            theme: ColorTheme::default(),
            animate: true,
            show_grid: true,
            show_labels: true,
            show_legend: true,
            font_family: "Inter, system-ui, sans-serif".to_string(),
            font_size: 12.0,
        }
    }
}

/// Get canvas context helper
pub fn get_canvas_context(canvas_id: &str) -> Result<(HtmlCanvasElement, CanvasRenderingContext2d), JsValue> {
    let window = web_sys::window().ok_or("No window")?;
    let document = window.document().ok_or("No document")?;
    let canvas = document
        .get_element_by_id(canvas_id)
        .ok_or_else(|| JsValue::from_str(&format!("Canvas '{}' not found", canvas_id)))?
        .dyn_into::<HtmlCanvasElement>()?;

    let ctx = canvas
        .get_context("2d")?
        .ok_or("Failed to get 2d context")?
        .dyn_into::<CanvasRenderingContext2d>()?;

    Ok((canvas, ctx))
}

/// Clear and prepare canvas for rendering
pub fn clear_canvas(ctx: &CanvasRenderingContext2d, width: f64, height: f64, bg_color: &str) {
    ctx.set_fill_style(&JsValue::from_str(bg_color));
    ctx.fill_rect(0.0, 0.0, width, height);
}

/// Draw grid lines
pub fn draw_grid(
    ctx: &CanvasRenderingContext2d,
    config: &ChartConfig,
    x_count: u32,
    y_count: u32,
) {
    let plot_width = config.width - config.padding.left - config.padding.right;
    let plot_height = config.height - config.padding.top - config.padding.bottom;

    ctx.set_stroke_style(&JsValue::from_str(&config.theme.grid));
    ctx.set_line_width(0.5);

    // Vertical grid lines
    for i in 0..=x_count {
        let x = config.padding.left + (i as f64 / x_count as f64) * plot_width;
        ctx.begin_path();
        ctx.move_to(x, config.padding.top);
        ctx.line_to(x, config.height - config.padding.bottom);
        ctx.stroke();
    }

    // Horizontal grid lines
    for i in 0..=y_count {
        let y = config.padding.top + (i as f64 / y_count as f64) * plot_height;
        ctx.begin_path();
        ctx.move_to(config.padding.left, y);
        ctx.line_to(config.width - config.padding.right, y);
        ctx.stroke();
    }
}

/// Draw axis labels
pub fn draw_axes(
    ctx: &CanvasRenderingContext2d,
    config: &ChartConfig,
    x_label: &str,
    y_label: &str,
) {
    ctx.set_fill_style(&JsValue::from_str(&config.theme.text));
    ctx.set_font(&format!("{}px {}", config.font_size, config.font_family));

    // X-axis label
    ctx.set_text_align("center");
    ctx.fill_text(
        x_label,
        config.width / 2.0,
        config.height - 10.0,
    ).ok();

    // Y-axis label (rotated)
    ctx.save();
    ctx.translate(15.0, config.height / 2.0).ok();
    ctx.rotate(-std::f64::consts::FRAC_PI_2).ok();
    ctx.fill_text(y_label, 0.0, 0.0).ok();
    ctx.restore();
}

/// Format number with appropriate precision
pub fn format_number(n: f64, precision: usize) -> String {
    if n.abs() >= 1000.0 {
        format!("{:.1}k", n / 1000.0)
    } else if precision == 0 {
        format!("{:.0}", n)
    } else {
        format!("{:.1$}", n, precision)
    }
}

/// Interpolate between two colors
pub fn interpolate_color(color1: &str, color2: &str, t: f64) -> String {
    let parse_hex = |c: &str| -> (u8, u8, u8) {
        let c = c.trim_start_matches('#');
        let r = u8::from_str_radix(&c[0..2], 16).unwrap_or(0);
        let g = u8::from_str_radix(&c[2..4], 16).unwrap_or(0);
        let b = u8::from_str_radix(&c[4..6], 16).unwrap_or(0);
        (r, g, b)
    };

    let (r1, g1, b1) = parse_hex(color1);
    let (r2, g2, b2) = parse_hex(color2);

    let r = (r1 as f64 + (r2 as f64 - r1 as f64) * t) as u8;
    let g = (g1 as f64 + (g2 as f64 - g1 as f64) * t) as u8;
    let b = (b1 as f64 + (b2 as f64 - b1 as f64) * t) as u8;

    format!("#{:02x}{:02x}{:02x}", r, g, b)
}

/// Tooltip data structure
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TooltipData {
    pub x: f64,
    pub y: f64,
    pub title: String,
    pub values: Vec<(String, String)>,
}

/// Hit test result for interactive elements
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HitTestResult {
    pub hit: bool,
    pub element_id: Option<String>,
    pub element_type: String,
    pub data: Option<serde_json::Value>,
}

impl HitTestResult {
    pub fn miss() -> Self {
        Self {
            hit: false,
            element_id: None,
            element_type: "none".to_string(),
            data: None,
        }
    }

    pub fn hit(id: &str, element_type: &str, data: serde_json::Value) -> Self {
        Self {
            hit: true,
            element_id: Some(id.to_string()),
            element_type: element_type.to_string(),
            data: Some(data),
        }
    }
}
