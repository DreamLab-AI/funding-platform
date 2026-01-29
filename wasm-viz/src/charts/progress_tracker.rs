//! Radial Progress Tracker
//!
//! Displays assessment completion rates as radial/donut charts.
//! Shows overall progress and per-assessor completion status.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use web_sys::CanvasRenderingContext2d;
use std::f64::consts::PI;

use super::common::{get_canvas_context, clear_canvas, ChartConfig, HitTestResult};

/// Progress data for an assessor or category
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProgressSegment {
    pub id: String,
    pub label: String,
    pub completed: u32,
    pub total: u32,
    pub color: Option<String>,
}

/// Progress tracker chart with radial visualization
#[wasm_bindgen]
pub struct ProgressTrackerChart {
    canvas_id: String,
    config: ChartConfig,
    segments: Vec<ProgressSegment>,
    center_label: String,
    center_value: String,
    hovered_segment: Option<usize>,
    animation_progress: f64,
}

#[wasm_bindgen]
impl ProgressTrackerChart {
    /// Create a new progress tracker chart
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str, config_js: JsValue) -> Result<ProgressTrackerChart, JsValue> {
        let config: ChartConfig = serde_wasm_bindgen::from_value(config_js)
            .unwrap_or_else(|_| ChartConfig::default());

        Ok(Self {
            canvas_id: canvas_id.to_string(),
            config,
            segments: Vec::new(),
            center_label: "Progress".to_string(),
            center_value: "0%".to_string(),
            hovered_segment: None,
            animation_progress: 1.0,
        })
    }

    /// Set the progress data
    pub fn set_data(&mut self, data_js: JsValue) -> Result<(), JsValue> {
        let segments: Vec<ProgressSegment> = serde_wasm_bindgen::from_value(data_js)?;
        self.segments = segments;

        // Calculate overall progress for center display
        let total_completed: u32 = self.segments.iter().map(|s| s.completed).sum();
        let total_items: u32 = self.segments.iter().map(|s| s.total).sum();

        if total_items > 0 {
            let pct = (total_completed as f64 / total_items as f64) * 100.0;
            self.center_value = format!("{:.1}%", pct);
        } else {
            self.center_value = "N/A".to_string();
        }

        self.animation_progress = 0.0;
        Ok(())
    }

    /// Set the center label text
    pub fn set_center_label(&mut self, label: &str) {
        self.center_label = label.to_string();
    }

    /// Render the chart
    pub fn render(&self) -> Result<(), JsValue> {
        let (canvas, ctx) = get_canvas_context(&self.canvas_id)?;

        canvas.set_width(self.config.width as u32);
        canvas.set_height(self.config.height as u32);

        clear_canvas(&ctx, self.config.width, self.config.height, &self.config.theme.background);

        if self.segments.is_empty() {
            self.draw_empty_state(&ctx)?;
            return Ok(());
        }

        // Draw the main donut chart
        self.draw_donut(&ctx)?;

        // Draw center text
        self.draw_center_text(&ctx)?;

        // Draw legend if enabled
        if self.config.show_legend {
            self.draw_legend(&ctx)?;
        }

        Ok(())
    }

    fn draw_donut(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let center_x = self.config.width / 2.0;
        let center_y = self.config.height / 2.0;
        let outer_radius = (self.config.width.min(self.config.height) / 2.0 - 60.0).max(50.0);
        let inner_radius = outer_radius * 0.6;

        let total: f64 = self.segments.iter().map(|s| s.total as f64).sum();
        if total == 0.0 {
            return Ok(());
        }

        let mut current_angle = -PI / 2.0; // Start from top

        for (i, segment) in self.segments.iter().enumerate() {
            let segment_angle = (segment.total as f64 / total) * 2.0 * PI * self.animation_progress;
            let completed_ratio = segment.completed as f64 / segment.total.max(1) as f64;

            // Get color for this segment
            let color = segment.color.clone().unwrap_or_else(|| {
                self.config.theme.accent[i % self.config.theme.accent.len()].clone()
            });

            let is_hovered = self.hovered_segment == Some(i);
            let radius_offset = if is_hovered { 5.0 } else { 0.0 };

            // Draw background arc (total)
            ctx.set_fill_style(&JsValue::from_str(&self.config.theme.grid));
            ctx.begin_path();
            ctx.arc(center_x, center_y, outer_radius + radius_offset, current_angle, current_angle + segment_angle)?;
            ctx.arc_with_anticlockwise(center_x, center_y, inner_radius + radius_offset, current_angle + segment_angle, current_angle, true)?;
            ctx.close_path();
            ctx.fill();

            // Draw completed arc
            let completed_angle = segment_angle * completed_ratio;
            ctx.set_fill_style(&JsValue::from_str(&color));
            ctx.set_global_alpha(if is_hovered { 1.0 } else { 0.9 });
            ctx.begin_path();
            ctx.arc(center_x, center_y, outer_radius + radius_offset, current_angle, current_angle + completed_angle)?;
            ctx.arc_with_anticlockwise(center_x, center_y, inner_radius + radius_offset, current_angle + completed_angle, current_angle, true)?;
            ctx.close_path();
            ctx.fill();
            ctx.set_global_alpha(1.0);

            // Draw segment separator
            if self.segments.len() > 1 {
                ctx.set_stroke_style(&JsValue::from_str(&self.config.theme.background));
                ctx.set_line_width(2.0);
                ctx.begin_path();
                ctx.move_to(
                    center_x + inner_radius * current_angle.cos(),
                    center_y + inner_radius * current_angle.sin(),
                );
                ctx.line_to(
                    center_x + outer_radius * current_angle.cos(),
                    center_y + outer_radius * current_angle.sin(),
                );
                ctx.stroke();
            }

            current_angle += segment_angle;
        }

        Ok(())
    }

    fn draw_center_text(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let center_x = self.config.width / 2.0;
        let center_y = self.config.height / 2.0;

        // Main percentage value
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.set_font(&format!("bold {}px {}", self.config.font_size * 2.5, self.config.font_family));
        ctx.set_text_align("center");
        ctx.set_text_baseline("middle");
        ctx.fill_text(&self.center_value, center_x, center_y - 10.0)?;

        // Label below
        ctx.set_font(&format!("{}px {}", self.config.font_size, self.config.font_family));
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.secondary));
        ctx.fill_text(&self.center_label, center_x, center_y + 20.0)?;

        Ok(())
    }

    fn draw_legend(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let legend_x = self.config.width - self.config.padding.right - 150.0;
        let mut legend_y = self.config.padding.top + 20.0;
        let item_height = 24.0;

        ctx.set_font(&format!("{}px {}", self.config.font_size - 1.0, self.config.font_family));
        ctx.set_text_align("left");

        for (i, segment) in self.segments.iter().enumerate() {
            let color = segment.color.clone().unwrap_or_else(|| {
                self.config.theme.accent[i % self.config.theme.accent.len()].clone()
            });

            // Color box
            ctx.set_fill_style(&JsValue::from_str(&color));
            ctx.fill_rect(legend_x, legend_y - 8.0, 12.0, 12.0);

            // Label
            ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
            ctx.fill_text(&segment.label, legend_x + 18.0, legend_y)?;

            // Progress count
            ctx.set_fill_style(&JsValue::from_str(&self.config.theme.secondary));
            ctx.fill_text(
                &format!("{}/{}", segment.completed, segment.total),
                legend_x + 100.0,
                legend_y,
            )?;

            legend_y += item_height;
        }

        Ok(())
    }

    fn draw_empty_state(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let center_x = self.config.width / 2.0;
        let center_y = self.config.height / 2.0;
        let radius = (self.config.width.min(self.config.height) / 2.0 - 60.0).max(50.0);

        // Draw empty circle
        ctx.set_stroke_style(&JsValue::from_str(&self.config.theme.grid));
        ctx.set_line_width(20.0);
        ctx.begin_path();
        ctx.arc(center_x, center_y, radius - 10.0, 0.0, 2.0 * PI)?;
        ctx.stroke();

        // Empty state text
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.secondary));
        ctx.set_font(&format!("{}px {}", self.config.font_size, self.config.font_family));
        ctx.set_text_align("center");
        ctx.fill_text("No data available", center_x, center_y)?;

        Ok(())
    }

    /// Advance animation (call from requestAnimationFrame)
    pub fn animate(&mut self, delta_ms: f64) -> bool {
        if self.animation_progress >= 1.0 {
            return false;
        }

        self.animation_progress = (self.animation_progress + delta_ms / 500.0).min(1.0);
        self.render().ok();
        self.animation_progress < 1.0
    }

    /// Handle mouse move for hover effects
    pub fn on_mouse_move(&mut self, x: f64, y: f64) -> JsValue {
        let center_x = self.config.width / 2.0;
        let center_y = self.config.height / 2.0;
        let outer_radius = (self.config.width.min(self.config.height) / 2.0 - 60.0).max(50.0);
        let inner_radius = outer_radius * 0.6;

        let dx = x - center_x;
        let dy = y - center_y;
        let distance = (dx * dx + dy * dy).sqrt();

        let old_hovered = self.hovered_segment;

        if distance >= inner_radius && distance <= outer_radius {
            let mut angle = dy.atan2(dx) + PI / 2.0;
            if angle < 0.0 {
                angle += 2.0 * PI;
            }

            let total: f64 = self.segments.iter().map(|s| s.total as f64).sum();
            if total > 0.0 {
                let mut cumulative_angle = 0.0;
                for (i, segment) in self.segments.iter().enumerate() {
                    let segment_angle = (segment.total as f64 / total) * 2.0 * PI;
                    if angle <= cumulative_angle + segment_angle {
                        self.hovered_segment = Some(i);

                        if old_hovered != self.hovered_segment {
                            self.render().ok();
                        }

                        let result = HitTestResult::hit(
                            &segment.id,
                            "progress_segment",
                            serde_json::json!({
                                "id": segment.id,
                                "label": segment.label,
                                "completed": segment.completed,
                                "total": segment.total,
                                "percentage": (segment.completed as f64 / segment.total.max(1) as f64) * 100.0
                            }),
                        );
                        return serde_wasm_bindgen::to_value(&result).unwrap();
                    }
                    cumulative_angle += segment_angle;
                }
            }
        }

        self.hovered_segment = None;
        if old_hovered.is_some() {
            self.render().ok();
        }
        serde_wasm_bindgen::to_value(&HitTestResult::miss()).unwrap()
    }

    /// Get overall progress statistics
    pub fn get_stats(&self) -> JsValue {
        let total_completed: u32 = self.segments.iter().map(|s| s.completed).sum();
        let total_items: u32 = self.segments.iter().map(|s| s.total).sum();

        let stats = serde_json::json!({
            "totalCompleted": total_completed,
            "totalItems": total_items,
            "overallPercentage": if total_items > 0 {
                (total_completed as f64 / total_items as f64) * 100.0
            } else {
                0.0
            },
            "segmentCount": self.segments.len(),
            "segments": self.segments.iter().map(|s| {
                serde_json::json!({
                    "id": s.id,
                    "label": s.label,
                    "completed": s.completed,
                    "total": s.total,
                    "percentage": (s.completed as f64 / s.total.max(1) as f64) * 100.0
                })
            }).collect::<Vec<_>>()
        });
        serde_wasm_bindgen::to_value(&stats).unwrap()
    }
}

/// Create a simple single-value radial progress chart
#[wasm_bindgen]
pub fn render_simple_progress(
    canvas_id: &str,
    value: f64,
    max_value: f64,
    label: &str,
    color: &str,
) -> Result<(), JsValue> {
    let (canvas, ctx) = get_canvas_context(canvas_id)?;
    let width = canvas.width() as f64;
    let height = canvas.height() as f64;

    clear_canvas(&ctx, width, height, "#FFFFFF");

    let center_x = width / 2.0;
    let center_y = height / 2.0;
    let radius = (width.min(height) / 2.0 - 20.0).max(30.0);
    let line_width = radius * 0.15;

    // Background arc
    ctx.set_stroke_style(&JsValue::from_str("#E5E7EB"));
    ctx.set_line_width(line_width);
    ctx.set_line_cap("round");
    ctx.begin_path();
    ctx.arc(center_x, center_y, radius - line_width / 2.0, 0.0, 2.0 * PI)?;
    ctx.stroke();

    // Progress arc
    let progress = (value / max_value).min(1.0).max(0.0);
    let end_angle = -PI / 2.0 + progress * 2.0 * PI;
    ctx.set_stroke_style(&JsValue::from_str(color));
    ctx.begin_path();
    ctx.arc(center_x, center_y, radius - line_width / 2.0, -PI / 2.0, end_angle)?;
    ctx.stroke();

    // Center text
    ctx.set_fill_style(&JsValue::from_str("#1F2937"));
    ctx.set_font(&format!("bold {}px Inter, system-ui, sans-serif", radius * 0.4));
    ctx.set_text_align("center");
    ctx.set_text_baseline("middle");
    ctx.fill_text(&format!("{:.0}%", progress * 100.0), center_x, center_y - 5.0)?;

    ctx.set_font(&format!("{}px Inter, system-ui, sans-serif", radius * 0.2));
    ctx.set_fill_style(&JsValue::from_str("#6B7280"));
    ctx.fill_text(label, center_x, center_y + radius * 0.25)?;

    Ok(())
}
