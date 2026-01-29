//! Submission Timeline
//!
//! Time-series visualization showing application submission patterns over time.
//! Useful for identifying submission peaks and deadline pressure.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use web_sys::CanvasRenderingContext2d;

use super::common::{get_canvas_context, clear_canvas, draw_grid, ChartConfig, HitTestResult, format_number};

/// Timeline data point
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimelineDataPoint {
    pub timestamp: f64, // Unix timestamp in milliseconds
    pub count: u32,
    pub cumulative: u32,
    pub label: Option<String>,
}

/// Important event marker
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub timestamp: f64,
    pub label: String,
    pub event_type: String, // "deadline", "open", "milestone"
}

/// Timeline chart
#[wasm_bindgen]
pub struct TimelineChart {
    canvas_id: String,
    config: ChartConfig,
    data: Vec<TimelineDataPoint>,
    events: Vec<TimelineEvent>,
    time_range: (f64, f64),
    max_count: u32,
    max_cumulative: u32,
    show_cumulative: bool,
    hovered_point: Option<usize>,
    granularity: String, // "hour", "day", "week"
}

#[wasm_bindgen]
impl TimelineChart {
    /// Create a new timeline chart
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str, config_js: JsValue) -> Result<TimelineChart, JsValue> {
        let config: ChartConfig = serde_wasm_bindgen::from_value(config_js)
            .unwrap_or_else(|_| ChartConfig::default());

        Ok(Self {
            canvas_id: canvas_id.to_string(),
            config,
            data: Vec::new(),
            events: Vec::new(),
            time_range: (0.0, 0.0),
            max_count: 0,
            max_cumulative: 0,
            show_cumulative: true,
            hovered_point: None,
            granularity: "day".to_string(),
        })
    }

    /// Set whether to show cumulative line
    pub fn set_show_cumulative(&mut self, show: bool) {
        self.show_cumulative = show;
    }

    /// Set timeline data
    pub fn set_data(&mut self, data_js: JsValue) -> Result<(), JsValue> {
        let data: Vec<TimelineDataPoint> = serde_wasm_bindgen::from_value(data_js)?;

        if data.is_empty() {
            self.data.clear();
            return Ok(());
        }

        // Calculate ranges
        self.time_range = (
            data.iter().map(|d| d.timestamp).fold(f64::INFINITY, f64::min),
            data.iter().map(|d| d.timestamp).fold(f64::NEG_INFINITY, f64::max),
        );

        self.max_count = data.iter().map(|d| d.count).max().unwrap_or(0);
        self.max_cumulative = data.iter().map(|d| d.cumulative).max().unwrap_or(0);

        self.data = data;
        Ok(())
    }

    /// Set event markers
    pub fn set_events(&mut self, events_js: JsValue) -> Result<(), JsValue> {
        let events: Vec<TimelineEvent> = serde_wasm_bindgen::from_value(events_js)?;
        self.events = events;
        Ok(())
    }

    /// Set time granularity
    pub fn set_granularity(&mut self, granularity: &str) {
        self.granularity = granularity.to_string();
    }

    /// Render the timeline
    pub fn render(&self) -> Result<(), JsValue> {
        let (canvas, ctx) = get_canvas_context(&self.canvas_id)?;

        canvas.set_width(self.config.width as u32);
        canvas.set_height(self.config.height as u32);

        clear_canvas(&ctx, self.config.width, self.config.height, &self.config.theme.background);

        if self.data.is_empty() {
            self.draw_empty_state(&ctx)?;
            return Ok(());
        }

        // Draw grid
        if self.config.show_grid {
            draw_grid(&ctx, &self.config, 10, 5);
        }

        // Draw event markers
        self.draw_events(&ctx)?;

        // Draw bar chart for counts
        self.draw_bars(&ctx)?;

        // Draw cumulative line if enabled
        if self.show_cumulative {
            self.draw_cumulative_line(&ctx)?;
        }

        // Draw axes
        self.draw_axes(&ctx)?;

        // Draw title and labels
        if self.config.show_labels {
            self.draw_labels(&ctx)?;
        }

        // Draw legend
        if self.config.show_legend {
            self.draw_legend(&ctx)?;
        }

        Ok(())
    }

    fn draw_bars(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
        let plot_height = self.config.height - self.config.padding.top - self.config.padding.bottom;

        let time_span = self.time_range.1 - self.time_range.0;
        if time_span <= 0.0 || self.max_count == 0 {
            return Ok(());
        }

        let bar_width = (plot_width / self.data.len() as f64).min(30.0);

        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.primary));

        for (i, point) in self.data.iter().enumerate() {
            let x = self.config.padding.left
                + ((point.timestamp - self.time_range.0) / time_span) * plot_width
                - bar_width / 2.0;
            let height = (point.count as f64 / self.max_count as f64) * plot_height * 0.8;
            let y = self.config.height - self.config.padding.bottom - height;

            let is_hovered = self.hovered_point == Some(i);
            ctx.set_global_alpha(if is_hovered { 1.0 } else { 0.7 });

            // Draw bar with rounded top
            ctx.begin_path();
            ctx.move_to(x, y + height);
            ctx.line_to(x, y + 4.0);
            ctx.quadratic_curve_to(x, y, x + 4.0, y);
            ctx.line_to(x + bar_width - 4.0, y);
            ctx.quadratic_curve_to(x + bar_width, y, x + bar_width, y + 4.0);
            ctx.line_to(x + bar_width, y + height);
            ctx.close_path();
            ctx.fill();
        }

        ctx.set_global_alpha(1.0);
        Ok(())
    }

    fn draw_cumulative_line(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
        let plot_height = self.config.height - self.config.padding.top - self.config.padding.bottom;

        let time_span = self.time_range.1 - self.time_range.0;
        if time_span <= 0.0 || self.max_cumulative == 0 {
            return Ok(());
        }

        ctx.set_stroke_style(&JsValue::from_str(&self.config.theme.success));
        ctx.set_line_width(2.5);
        ctx.begin_path();

        let mut first = true;
        for point in &self.data {
            let x = self.config.padding.left
                + ((point.timestamp - self.time_range.0) / time_span) * plot_width;
            let y = self.config.height
                - self.config.padding.bottom
                - (point.cumulative as f64 / self.max_cumulative as f64) * plot_height;

            if first {
                ctx.move_to(x, y);
                first = false;
            } else {
                ctx.line_to(x, y);
            }
        }

        ctx.stroke();

        // Draw points
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.success));
        for (i, point) in self.data.iter().enumerate() {
            let x = self.config.padding.left
                + ((point.timestamp - self.time_range.0) / time_span) * plot_width;
            let y = self.config.height
                - self.config.padding.bottom
                - (point.cumulative as f64 / self.max_cumulative as f64) * plot_height;

            let is_hovered = self.hovered_point == Some(i);
            let radius = if is_hovered { 6.0 } else { 4.0 };

            ctx.begin_path();
            ctx.arc(x, y, radius, 0.0, std::f64::consts::PI * 2.0)?;
            ctx.fill();
        }

        Ok(())
    }

    fn draw_events(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
        let time_span = self.time_range.1 - self.time_range.0;

        if time_span <= 0.0 {
            return Ok(());
        }

        for event in &self.events {
            let x = self.config.padding.left
                + ((event.timestamp - self.time_range.0) / time_span) * plot_width;

            // Draw vertical line
            let color = match event.event_type.as_str() {
                "deadline" => &self.config.theme.danger,
                "open" => &self.config.theme.success,
                _ => &self.config.theme.warning,
            };

            ctx.set_stroke_style(&JsValue::from_str(color));
            ctx.set_line_width(2.0);
            ctx.set_line_dash(&JsValue::from(js_sys::Array::of2(&JsValue::from(5), &JsValue::from(5))))?;

            ctx.begin_path();
            ctx.move_to(x, self.config.padding.top);
            ctx.line_to(x, self.config.height - self.config.padding.bottom);
            ctx.stroke();

            ctx.set_line_dash(&JsValue::from(js_sys::Array::new()))?;

            // Draw label
            ctx.set_fill_style(&JsValue::from_str(color));
            ctx.set_font(&format!("{}px {}", self.config.font_size - 2.0, self.config.font_family));
            ctx.set_text_align("center");

            // Rotate text for better readability
            ctx.save();
            ctx.translate(x, self.config.padding.top - 5.0)?;
            ctx.rotate(-std::f64::consts::FRAC_PI_4)?;
            ctx.fill_text(&event.label, 0.0, 0.0)?;
            ctx.restore();
        }

        Ok(())
    }

    fn draw_axes(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
        let plot_height = self.config.height - self.config.padding.top - self.config.padding.bottom;

        ctx.set_stroke_style(&JsValue::from_str(&self.config.theme.text));
        ctx.set_line_width(1.0);

        // X-axis
        ctx.begin_path();
        ctx.move_to(self.config.padding.left, self.config.height - self.config.padding.bottom);
        ctx.line_to(self.config.width - self.config.padding.right, self.config.height - self.config.padding.bottom);
        ctx.stroke();

        // Y-axis (left - counts)
        ctx.begin_path();
        ctx.move_to(self.config.padding.left, self.config.padding.top);
        ctx.line_to(self.config.padding.left, self.config.height - self.config.padding.bottom);
        ctx.stroke();

        // Y-axis (right - cumulative)
        if self.show_cumulative {
            ctx.begin_path();
            ctx.move_to(self.config.width - self.config.padding.right, self.config.padding.top);
            ctx.line_to(self.config.width - self.config.padding.right, self.config.height - self.config.padding.bottom);
            ctx.stroke();
        }

        // X-axis time labels
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.set_font(&format!("{}px {}", self.config.font_size - 2.0, self.config.font_family));
        ctx.set_text_align("center");

        let label_count = 6;
        let time_span = self.time_range.1 - self.time_range.0;

        for i in 0..=label_count {
            let t = i as f64 / label_count as f64;
            let timestamp = self.time_range.0 + t * time_span;
            let x = self.config.padding.left + t * plot_width;

            // Format timestamp (simplified)
            let date = js_sys::Date::new(&JsValue::from_f64(timestamp));
            let label = format!(
                "{}/{} {}:{}",
                date.get_date(),
                date.get_month() + 1,
                date.get_hours(),
                format!("{:02}", date.get_minutes())
            );

            ctx.fill_text(&label, x, self.config.height - self.config.padding.bottom + 15.0)?;
        }

        // Left Y-axis labels (counts)
        ctx.set_text_align("right");
        for i in 0..=5 {
            let t = i as f64 / 5.0;
            let y = self.config.height - self.config.padding.bottom - t * plot_height;
            let value = (t * self.max_count as f64).round() as u32;

            ctx.fill_text(
                &format_number(value as f64, 0),
                self.config.padding.left - 10.0,
                y + 4.0,
            )?;
        }

        // Right Y-axis labels (cumulative)
        if self.show_cumulative {
            ctx.set_text_align("left");
            ctx.set_fill_style(&JsValue::from_str(&self.config.theme.success));

            for i in 0..=5 {
                let t = i as f64 / 5.0;
                let y = self.config.height - self.config.padding.bottom - t * plot_height;
                let value = (t * self.max_cumulative as f64).round() as u32;

                ctx.fill_text(
                    &format_number(value as f64, 0),
                    self.config.width - self.config.padding.right + 10.0,
                    y + 4.0,
                )?;
            }
        }

        Ok(())
    }

    fn draw_labels(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));

        // Title
        ctx.set_font(&format!("bold {}px {}", self.config.font_size + 2.0, self.config.font_family));
        ctx.set_text_align("center");
        ctx.fill_text(
            "Application Submission Timeline",
            self.config.width / 2.0,
            20.0,
        )?;

        Ok(())
    }

    fn draw_legend(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let legend_y = 20.0;
        let legend_x = self.config.width - self.config.padding.right - 200.0;

        ctx.set_font(&format!("{}px {}", self.config.font_size - 1.0, self.config.font_family));
        ctx.set_text_align("left");

        // Daily submissions
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.primary));
        ctx.fill_rect(legend_x, legend_y - 8.0, 16.0, 12.0);
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.fill_text("Submissions", legend_x + 22.0, legend_y)?;

        // Cumulative
        if self.show_cumulative {
            ctx.set_stroke_style(&JsValue::from_str(&self.config.theme.success));
            ctx.set_line_width(2.0);
            ctx.begin_path();
            ctx.move_to(legend_x + 100.0, legend_y - 2.0);
            ctx.line_to(legend_x + 116.0, legend_y - 2.0);
            ctx.stroke();

            ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
            ctx.fill_text("Cumulative", legend_x + 122.0, legend_y)?;
        }

        Ok(())
    }

    fn draw_empty_state(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.secondary));
        ctx.set_font(&format!("{}px {}", self.config.font_size, self.config.font_family));
        ctx.set_text_align("center");
        ctx.fill_text(
            "No timeline data available",
            self.config.width / 2.0,
            self.config.height / 2.0,
        )?;
        Ok(())
    }

    /// Handle mouse move
    pub fn on_mouse_move(&mut self, x: f64, y: f64) -> JsValue {
        let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
        let time_span = self.time_range.1 - self.time_range.0;

        if time_span <= 0.0 {
            return serde_wasm_bindgen::to_value(&HitTestResult::miss()).unwrap();
        }

        let old_hovered = self.hovered_point;

        // Find closest point
        let mut min_dist = f64::INFINITY;
        let mut closest_idx: Option<usize> = None;

        for (i, point) in self.data.iter().enumerate() {
            let px = self.config.padding.left
                + ((point.timestamp - self.time_range.0) / time_span) * plot_width;

            let dist = (px - x).abs();
            if dist < min_dist && dist < 30.0 {
                min_dist = dist;
                closest_idx = Some(i);
            }
        }

        self.hovered_point = closest_idx;

        if self.hovered_point != old_hovered {
            self.render().ok();
        }

        if let Some(idx) = self.hovered_point {
            let point = &self.data[idx];
            let date = js_sys::Date::new(&JsValue::from_f64(point.timestamp));

            let result = HitTestResult::hit(
                &format!("point-{}", idx),
                "timeline_point",
                serde_json::json!({
                    "index": idx,
                    "timestamp": point.timestamp,
                    "date": format!("{}-{:02}-{:02} {:02}:{:02}",
                        date.get_full_year(),
                        date.get_month() + 1,
                        date.get_date(),
                        date.get_hours(),
                        date.get_minutes()
                    ),
                    "count": point.count,
                    "cumulative": point.cumulative,
                    "label": point.label
                }),
            );
            return serde_wasm_bindgen::to_value(&result).unwrap();
        }

        serde_wasm_bindgen::to_value(&HitTestResult::miss()).unwrap()
    }

    /// Get statistics
    pub fn get_stats(&self) -> JsValue {
        let total_submissions: u32 = self.data.iter().map(|d| d.count).sum();
        let peak_day = self.data.iter().max_by_key(|d| d.count);

        let stats = serde_json::json!({
            "totalSubmissions": total_submissions,
            "dataPoints": self.data.len(),
            "peakCount": peak_day.map(|p| p.count).unwrap_or(0),
            "peakTimestamp": peak_day.map(|p| p.timestamp),
            "timeRange": {
                "start": self.time_range.0,
                "end": self.time_range.1
            },
            "eventCount": self.events.len()
        });
        serde_wasm_bindgen::to_value(&stats).unwrap()
    }
}
