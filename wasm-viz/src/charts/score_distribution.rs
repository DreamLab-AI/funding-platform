//! Score Distribution Histogram
//!
//! Renders a histogram showing the distribution of assessment scores across applications.
//! Optimized for displaying score patterns for 1000+ applications.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use web_sys::CanvasRenderingContext2d;

use super::common::{get_canvas_context, clear_canvas, draw_grid, ChartConfig, HitTestResult};

/// Score data point for a single application
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ScoreDataPoint {
    pub application_id: String,
    pub reference: String,
    pub score: f64,
    pub max_score: f64,
    pub assessor_count: u32,
    pub variance: Option<f64>,
}

/// Histogram bin with aggregated data
#[derive(Clone, Debug, Serialize, Deserialize)]
struct HistogramBin {
    min: f64,
    max: f64,
    count: u32,
    applications: Vec<String>,
    avg_variance: f64,
}

/// Score distribution chart state (kept between renders for interactivity)
#[wasm_bindgen]
pub struct ScoreDistributionChart {
    canvas_id: String,
    config: ChartConfig,
    bins: Vec<HistogramBin>,
    total_count: u32,
    max_count: u32,
    score_range: (f64, f64),
    hovered_bin: Option<usize>,
}

#[wasm_bindgen]
impl ScoreDistributionChart {
    /// Create a new score distribution chart
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str, config_js: JsValue) -> Result<ScoreDistributionChart, JsValue> {
        let config: ChartConfig = serde_wasm_bindgen::from_value(config_js)
            .unwrap_or_else(|_| ChartConfig::default());

        Ok(Self {
            canvas_id: canvas_id.to_string(),
            config,
            bins: Vec::new(),
            total_count: 0,
            max_count: 0,
            score_range: (0.0, 100.0),
            hovered_bin: None,
        })
    }

    /// Update chart data and recalculate bins
    pub fn set_data(&mut self, data_js: JsValue, bin_count: u32) -> Result<(), JsValue> {
        let data: Vec<ScoreDataPoint> = serde_wasm_bindgen::from_value(data_js)?;

        if data.is_empty() {
            self.bins.clear();
            self.total_count = 0;
            self.max_count = 0;
            return Ok(());
        }

        // Calculate score range from data
        let min_score = data.iter().map(|d| d.score).fold(f64::INFINITY, f64::min);
        let max_score = data.iter().map(|d| d.score).fold(f64::NEG_INFINITY, f64::max);

        // Normalize to percentage if max_score varies
        let normalized: Vec<(f64, &ScoreDataPoint)> = data.iter()
            .map(|d| {
                let pct = if d.max_score > 0.0 { (d.score / d.max_score) * 100.0 } else { 0.0 };
                (pct, d)
            })
            .collect();

        self.score_range = (0.0, 100.0);
        let bin_width = 100.0 / bin_count as f64;

        // Initialize bins
        self.bins = (0..bin_count)
            .map(|i| HistogramBin {
                min: i as f64 * bin_width,
                max: (i + 1) as f64 * bin_width,
                count: 0,
                applications: Vec::new(),
                avg_variance: 0.0,
            })
            .collect();

        // Distribute data into bins
        for (pct, point) in &normalized {
            let bin_idx = ((pct / bin_width).floor() as usize).min(bin_count as usize - 1);
            self.bins[bin_idx].count += 1;
            self.bins[bin_idx].applications.push(point.application_id.clone());
            if let Some(v) = point.variance {
                self.bins[bin_idx].avg_variance += v;
            }
        }

        // Calculate averages
        for bin in &mut self.bins {
            if bin.count > 0 {
                bin.avg_variance /= bin.count as f64;
            }
        }

        self.total_count = data.len() as u32;
        self.max_count = self.bins.iter().map(|b| b.count).max().unwrap_or(0);

        Ok(())
    }

    /// Render the chart to canvas
    pub fn render(&self) -> Result<(), JsValue> {
        let (canvas, ctx) = get_canvas_context(&self.canvas_id)?;

        // Set canvas size
        canvas.set_width(self.config.width as u32);
        canvas.set_height(self.config.height as u32);

        // Clear background
        clear_canvas(&ctx, self.config.width, self.config.height, &self.config.theme.background);

        // Draw grid if enabled
        if self.config.show_grid {
            draw_grid(&ctx, &self.config, self.bins.len() as u32, 5);
        }

        // Draw bars
        self.draw_bars(&ctx)?;

        // Draw axes
        self.draw_axes(&ctx)?;

        // Draw title and legend
        if self.config.show_labels {
            self.draw_labels(&ctx)?;
        }

        Ok(())
    }

    fn draw_bars(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        if self.bins.is_empty() || self.max_count == 0 {
            return Ok(());
        }

        let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
        let plot_height = self.config.height - self.config.padding.top - self.config.padding.bottom;
        let bar_width = plot_width / self.bins.len() as f64;
        let bar_gap = 2.0;

        for (i, bin) in self.bins.iter().enumerate() {
            let height = (bin.count as f64 / self.max_count as f64) * plot_height;
            let x = self.config.padding.left + i as f64 * bar_width + bar_gap / 2.0;
            let y = self.config.height - self.config.padding.bottom - height;

            // Color based on score range (green for high, yellow for mid, red for low)
            let score_pct = (bin.min + bin.max) / 2.0 / 100.0;
            let color = if score_pct > 0.7 {
                &self.config.theme.success
            } else if score_pct > 0.4 {
                &self.config.theme.warning
            } else {
                &self.config.theme.danger
            };

            // Highlight hovered bin
            let is_hovered = self.hovered_bin == Some(i);

            ctx.set_fill_style(&JsValue::from_str(color));
            ctx.set_global_alpha(if is_hovered { 1.0 } else { 0.8 });

            // Draw rounded rectangle for bar
            let radius = 4.0;
            let bw = bar_width - bar_gap;
            ctx.begin_path();
            ctx.move_to(x + radius, y);
            ctx.line_to(x + bw - radius, y);
            ctx.quadratic_curve_to(x + bw, y, x + bw, y + radius);
            ctx.line_to(x + bw, y + height);
            ctx.line_to(x, y + height);
            ctx.line_to(x, y + radius);
            ctx.quadratic_curve_to(x, y, x + radius, y);
            ctx.close_path();
            ctx.fill();

            // Draw count label on top of bar
            if bin.count > 0 && height > 20.0 {
                ctx.set_global_alpha(1.0);
                ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
                ctx.set_font(&format!("bold {}px {}", self.config.font_size - 2.0, self.config.font_family));
                ctx.set_text_align("center");
                ctx.fill_text(
                    &format!("{}", bin.count),
                    x + bw / 2.0,
                    y - 5.0,
                )?;
            }
        }

        ctx.set_global_alpha(1.0);
        Ok(())
    }

    fn draw_axes(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
        let plot_height = self.config.height - self.config.padding.top - self.config.padding.bottom;

        ctx.set_stroke_style(&JsValue::from_str(&self.config.theme.text));
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.set_line_width(1.0);

        // X-axis
        ctx.begin_path();
        ctx.move_to(self.config.padding.left, self.config.height - self.config.padding.bottom);
        ctx.line_to(self.config.width - self.config.padding.right, self.config.height - self.config.padding.bottom);
        ctx.stroke();

        // Y-axis
        ctx.begin_path();
        ctx.move_to(self.config.padding.left, self.config.padding.top);
        ctx.line_to(self.config.padding.left, self.config.height - self.config.padding.bottom);
        ctx.stroke();

        // X-axis labels (score percentages)
        ctx.set_font(&format!("{}px {}", self.config.font_size - 2.0, self.config.font_family));
        ctx.set_text_align("center");

        let labels = ["0%", "25%", "50%", "75%", "100%"];
        for (i, label) in labels.iter().enumerate() {
            let x = self.config.padding.left + (i as f64 / 4.0) * plot_width;
            ctx.fill_text(
                label,
                x,
                self.config.height - self.config.padding.bottom + 20.0,
            )?;
        }

        // Y-axis labels (counts)
        ctx.set_text_align("right");
        for i in 0..=5 {
            let y = self.config.height - self.config.padding.bottom - (i as f64 / 5.0) * plot_height;
            let count = (i as f64 / 5.0 * self.max_count as f64).round() as u32;
            ctx.fill_text(
                &format!("{}", count),
                self.config.padding.left - 10.0,
                y + 4.0,
            )?;
        }

        Ok(())
    }

    fn draw_labels(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));

        // Title
        ctx.set_font(&format!("bold {}px {}", self.config.font_size + 4.0, self.config.font_family));
        ctx.set_text_align("center");
        ctx.fill_text(
            "Score Distribution",
            self.config.width / 2.0,
            25.0,
        )?;

        // X-axis label
        ctx.set_font(&format!("{}px {}", self.config.font_size, self.config.font_family));
        ctx.fill_text(
            "Score (%)",
            self.config.width / 2.0,
            self.config.height - 10.0,
        )?;

        // Y-axis label
        ctx.save();
        ctx.translate(15.0, self.config.height / 2.0)?;
        ctx.rotate(-std::f64::consts::FRAC_PI_2)?;
        ctx.fill_text("Applications", 0.0, 0.0)?;
        ctx.restore();

        // Summary stats
        if self.total_count > 0 {
            ctx.set_font(&format!("{}px {}", self.config.font_size - 2.0, self.config.font_family));
            ctx.set_text_align("right");
            ctx.fill_text(
                &format!("Total: {} applications", self.total_count),
                self.config.width - 20.0,
                25.0,
            )?;
        }

        Ok(())
    }

    /// Handle mouse move for hover effects
    pub fn on_mouse_move(&mut self, x: f64, y: f64) -> JsValue {
        let old_hovered = self.hovered_bin;

        // Check if mouse is within plot area
        if x >= self.config.padding.left
            && x <= self.config.width - self.config.padding.right
            && y >= self.config.padding.top
            && y <= self.config.height - self.config.padding.bottom
        {
            let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
            let relative_x = x - self.config.padding.left;
            let bin_idx = ((relative_x / plot_width) * self.bins.len() as f64).floor() as usize;

            if bin_idx < self.bins.len() {
                self.hovered_bin = Some(bin_idx);
                let bin = &self.bins[bin_idx];

                let result = HitTestResult::hit(
                    &format!("bin-{}", bin_idx),
                    "histogram_bin",
                    serde_json::json!({
                        "binIndex": bin_idx,
                        "min": bin.min,
                        "max": bin.max,
                        "count": bin.count,
                        "avgVariance": bin.avg_variance,
                        "applications": &bin.applications[..bin.applications.len().min(10)]
                    }),
                );

                if old_hovered != self.hovered_bin {
                    self.render().ok();
                }

                return serde_wasm_bindgen::to_value(&result).unwrap();
            }
        }

        self.hovered_bin = None;
        if old_hovered.is_some() {
            self.render().ok();
        }
        serde_wasm_bindgen::to_value(&HitTestResult::miss()).unwrap()
    }

    /// Get current chart statistics
    pub fn get_stats(&self) -> JsValue {
        let stats = serde_json::json!({
            "totalApplications": self.total_count,
            "binCount": self.bins.len(),
            "maxBinCount": self.max_count,
            "bins": self.bins.iter().map(|b| {
                serde_json::json!({
                    "range": format!("{:.0}%-{:.0}%", b.min, b.max),
                    "count": b.count,
                    "avgVariance": b.avg_variance
                })
            }).collect::<Vec<_>>()
        });
        serde_wasm_bindgen::to_value(&stats).unwrap()
    }
}
