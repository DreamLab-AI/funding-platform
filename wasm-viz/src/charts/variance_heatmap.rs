//! Variance Heatmap
//!
//! Visualizes score variance between assessors for each application.
//! Color intensity indicates the level of disagreement between assessors.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use web_sys::CanvasRenderingContext2d;

use super::common::{get_canvas_context, clear_canvas, ChartConfig, HitTestResult, interpolate_color};

/// Variance data for a single application
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VarianceDataPoint {
    pub application_id: String,
    pub reference: String,
    pub scores: Vec<f64>,
    pub assessor_names: Vec<String>,
    pub variance: f64,
    pub mean: f64,
    pub flagged: bool,
}

/// Cell position in the heatmap
#[derive(Clone, Debug)]
struct CellPosition {
    row: usize,
    col: usize,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// Variance heatmap chart
#[wasm_bindgen]
pub struct VarianceHeatmapChart {
    canvas_id: String,
    config: ChartConfig,
    data: Vec<VarianceDataPoint>,
    max_assessors: usize,
    variance_threshold: f64,
    cell_positions: Vec<CellPosition>,
    hovered_cell: Option<(usize, usize)>,
    scroll_offset: f64,
    visible_rows: usize,
}

#[wasm_bindgen]
impl VarianceHeatmapChart {
    /// Create a new variance heatmap chart
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str, config_js: JsValue) -> Result<VarianceHeatmapChart, JsValue> {
        let config: ChartConfig = serde_wasm_bindgen::from_value(config_js)
            .unwrap_or_else(|_| ChartConfig::default());

        Ok(Self {
            canvas_id: canvas_id.to_string(),
            config,
            data: Vec::new(),
            max_assessors: 0,
            variance_threshold: 10.0,
            cell_positions: Vec::new(),
            hovered_cell: None,
            scroll_offset: 0.0,
            visible_rows: 20,
        })
    }

    /// Set the variance threshold for flagging
    pub fn set_variance_threshold(&mut self, threshold: f64) {
        self.variance_threshold = threshold;
    }

    /// Set data and compute layout
    pub fn set_data(&mut self, data_js: JsValue) -> Result<(), JsValue> {
        let data: Vec<VarianceDataPoint> = serde_wasm_bindgen::from_value(data_js)?;

        self.max_assessors = data.iter().map(|d| d.scores.len()).max().unwrap_or(0);
        self.data = data;
        self.scroll_offset = 0.0;

        self.compute_cell_positions();
        Ok(())
    }

    fn compute_cell_positions(&mut self) {
        self.cell_positions.clear();

        let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
        let plot_height = self.config.height - self.config.padding.top - self.config.padding.bottom;

        // Calculate cell dimensions
        let row_count = self.visible_rows.min(self.data.len());
        let col_count = self.max_assessors.max(1);

        let cell_width = (plot_width - 100.0) / col_count as f64; // Reserve 100px for labels
        let cell_height = plot_height / row_count as f64;

        let start_row = (self.scroll_offset / cell_height) as usize;
        let end_row = (start_row + row_count + 1).min(self.data.len());

        for row in start_row..end_row {
            for col in 0..col_count {
                let x = self.config.padding.left + 100.0 + col as f64 * cell_width;
                let y = self.config.padding.top + (row - start_row) as f64 * cell_height;

                self.cell_positions.push(CellPosition {
                    row,
                    col,
                    x,
                    y,
                    width: cell_width,
                    height: cell_height,
                });
            }
        }
    }

    /// Render the heatmap
    pub fn render(&self) -> Result<(), JsValue> {
        let (canvas, ctx) = get_canvas_context(&self.canvas_id)?;

        canvas.set_width(self.config.width as u32);
        canvas.set_height(self.config.height as u32);

        clear_canvas(&ctx, self.config.width, self.config.height, &self.config.theme.background);

        if self.data.is_empty() {
            self.draw_empty_state(&ctx)?;
            return Ok(());
        }

        // Draw header
        self.draw_header(&ctx)?;

        // Draw row labels
        self.draw_row_labels(&ctx)?;

        // Draw column headers
        self.draw_column_headers(&ctx)?;

        // Draw cells
        self.draw_cells(&ctx)?;

        // Draw variance column
        self.draw_variance_column(&ctx)?;

        // Draw legend
        if self.config.show_legend {
            self.draw_legend(&ctx)?;
        }

        Ok(())
    }

    fn draw_header(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.set_font(&format!("bold {}px {}", self.config.font_size + 2.0, self.config.font_family));
        ctx.set_text_align("center");
        ctx.fill_text(
            "Score Variance by Assessor",
            self.config.width / 2.0,
            20.0,
        )?;
        Ok(())
    }

    fn draw_row_labels(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let plot_height = self.config.height - self.config.padding.top - self.config.padding.bottom;
        let row_count = self.visible_rows.min(self.data.len());
        let cell_height = plot_height / row_count as f64;

        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.set_font(&format!("{}px {}", self.config.font_size - 2.0, self.config.font_family));
        ctx.set_text_align("right");

        let start_row = (self.scroll_offset / cell_height) as usize;

        for (i, data) in self.data.iter().enumerate().skip(start_row).take(row_count + 1) {
            let y = self.config.padding.top + (i - start_row) as f64 * cell_height + cell_height / 2.0;

            // Truncate reference if too long
            let ref_text = if data.reference.len() > 12 {
                format!("{}...", &data.reference[..9])
            } else {
                data.reference.clone()
            };

            ctx.fill_text(&ref_text, self.config.padding.left + 90.0, y + 4.0)?;
        }

        Ok(())
    }

    fn draw_column_headers(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let plot_width = self.config.width - self.config.padding.left - self.config.padding.right;
        let cell_width = (plot_width - 100.0) / self.max_assessors.max(1) as f64;

        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.set_font(&format!("{}px {}", self.config.font_size - 2.0, self.config.font_family));
        ctx.set_text_align("center");

        for col in 0..self.max_assessors {
            let x = self.config.padding.left + 100.0 + col as f64 * cell_width + cell_width / 2.0;
            ctx.fill_text(&format!("A{}", col + 1), x, self.config.padding.top - 10.0)?;
        }

        // Variance column header
        ctx.fill_text(
            "Var",
            self.config.width - self.config.padding.right - 25.0,
            self.config.padding.top - 10.0,
        )?;

        Ok(())
    }

    fn draw_cells(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        for cell in &self.cell_positions {
            if cell.row >= self.data.len() {
                continue;
            }

            let data = &self.data[cell.row];

            // Get score for this cell if available
            let score = data.scores.get(cell.col).copied();
            let is_hovered = self.hovered_cell == Some((cell.row, cell.col));

            // Draw cell background
            let bg_color = if let Some(s) = score {
                // Color based on score value (normalized to 0-100)
                let normalized = (s / 100.0).min(1.0).max(0.0);
                interpolate_color(&self.config.theme.danger, &self.config.theme.success, normalized)
            } else {
                self.config.theme.grid.clone()
            };

            ctx.set_fill_style(&JsValue::from_str(&bg_color));
            ctx.set_global_alpha(if is_hovered { 1.0 } else { 0.85 });
            ctx.fill_rect(cell.x + 1.0, cell.y + 1.0, cell.width - 2.0, cell.height - 2.0);
            ctx.set_global_alpha(1.0);

            // Draw score value if available
            if let Some(s) = score {
                ctx.set_fill_style(&JsValue::from_str("#FFFFFF"));
                ctx.set_font(&format!("{}px {}", self.config.font_size - 2.0, self.config.font_family));
                ctx.set_text_align("center");
                ctx.fill_text(
                    &format!("{:.0}", s),
                    cell.x + cell.width / 2.0,
                    cell.y + cell.height / 2.0 + 4.0,
                )?;
            }

            // Draw border for hovered cell
            if is_hovered {
                ctx.set_stroke_style(&JsValue::from_str(&self.config.theme.primary));
                ctx.set_line_width(2.0);
                ctx.stroke_rect(cell.x, cell.y, cell.width, cell.height);
            }
        }

        Ok(())
    }

    fn draw_variance_column(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let plot_height = self.config.height - self.config.padding.top - self.config.padding.bottom;
        let row_count = self.visible_rows.min(self.data.len());
        let cell_height = plot_height / row_count as f64;

        let var_x = self.config.width - self.config.padding.right - 50.0;
        let start_row = (self.scroll_offset / cell_height) as usize;

        ctx.set_font(&format!("bold {}px {}", self.config.font_size - 2.0, self.config.font_family));
        ctx.set_text_align("center");

        for (i, data) in self.data.iter().enumerate().skip(start_row).take(row_count + 1) {
            let y = self.config.padding.top + (i - start_row) as f64 * cell_height;

            // Color based on variance (red if above threshold)
            let is_flagged = data.variance > self.variance_threshold;
            let color = if is_flagged {
                &self.config.theme.danger
            } else {
                &self.config.theme.success
            };

            ctx.set_fill_style(&JsValue::from_str(color));
            ctx.fill_rect(var_x, y + 1.0, 50.0, cell_height - 2.0);

            // Draw variance value
            ctx.set_fill_style(&JsValue::from_str("#FFFFFF"));
            ctx.fill_text(
                &format!("{:.1}", data.variance),
                var_x + 25.0,
                y + cell_height / 2.0 + 4.0,
            )?;

            // Draw flag indicator
            if is_flagged {
                ctx.fill_text("!", var_x + 45.0, y + 12.0)?;
            }
        }

        Ok(())
    }

    fn draw_legend(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let legend_y = self.config.height - 25.0;

        ctx.set_font(&format!("{}px {}", self.config.font_size - 2.0, self.config.font_family));
        ctx.set_text_align("left");

        // Score gradient legend
        let gradient_width = 150.0;
        let gradient_x = self.config.padding.left;

        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.fill_text("Score:", gradient_x, legend_y)?;

        // Draw gradient
        for i in 0..50 {
            let x = gradient_x + 50.0 + i as f64 * 3.0;
            let color = interpolate_color(&self.config.theme.danger, &self.config.theme.success, i as f64 / 49.0);
            ctx.set_fill_style(&JsValue::from_str(&color));
            ctx.fill_rect(x, legend_y - 10.0, 3.0, 12.0);
        }

        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.fill_text("0", gradient_x + 50.0, legend_y)?;
        ctx.fill_text("100", gradient_x + 155.0, legend_y)?;

        // Variance legend
        let var_legend_x = self.config.width / 2.0;
        ctx.fill_text("Variance:", var_legend_x, legend_y)?;

        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.success));
        ctx.fill_rect(var_legend_x + 60.0, legend_y - 10.0, 20.0, 12.0);
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.fill_text(&format!("< {}", self.variance_threshold), var_legend_x + 85.0, legend_y)?;

        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.danger));
        ctx.fill_rect(var_legend_x + 130.0, legend_y - 10.0, 20.0, 12.0);
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
        ctx.fill_text(&format!(">= {} (flagged)", self.variance_threshold), var_legend_x + 155.0, legend_y)?;

        Ok(())
    }

    fn draw_empty_state(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.secondary));
        ctx.set_font(&format!("{}px {}", self.config.font_size, self.config.font_family));
        ctx.set_text_align("center");
        ctx.fill_text(
            "No variance data available",
            self.config.width / 2.0,
            self.config.height / 2.0,
        )?;
        Ok(())
    }

    /// Handle scroll
    pub fn on_scroll(&mut self, delta_y: f64) {
        let plot_height = self.config.height - self.config.padding.top - self.config.padding.bottom;
        let row_count = self.visible_rows.min(self.data.len());
        let cell_height = plot_height / row_count as f64;

        let max_scroll = (self.data.len() as f64 - row_count as f64) * cell_height;

        self.scroll_offset = (self.scroll_offset + delta_y).max(0.0).min(max_scroll.max(0.0));
        self.compute_cell_positions();
        self.render().ok();
    }

    /// Handle mouse move
    pub fn on_mouse_move(&mut self, x: f64, y: f64) -> JsValue {
        let old_hovered = self.hovered_cell;

        // Find cell under mouse
        for cell in &self.cell_positions {
            if x >= cell.x && x <= cell.x + cell.width
                && y >= cell.y && y <= cell.y + cell.height
            {
                self.hovered_cell = Some((cell.row, cell.col));

                if old_hovered != self.hovered_cell {
                    self.render().ok();
                }

                if cell.row < self.data.len() {
                    let data = &self.data[cell.row];
                    let score = data.scores.get(cell.col).copied();
                    let assessor = data.assessor_names.get(cell.col)
                        .cloned()
                        .unwrap_or_else(|| format!("Assessor {}", cell.col + 1));

                    let result = HitTestResult::hit(
                        &format!("{}-{}", data.application_id, cell.col),
                        "heatmap_cell",
                        serde_json::json!({
                            "applicationId": data.application_id,
                            "reference": data.reference,
                            "assessor": assessor,
                            "score": score,
                            "variance": data.variance,
                            "mean": data.mean,
                            "flagged": data.flagged
                        }),
                    );
                    return serde_wasm_bindgen::to_value(&result).unwrap();
                }
            }
        }

        self.hovered_cell = None;
        if old_hovered.is_some() {
            self.render().ok();
        }
        serde_wasm_bindgen::to_value(&HitTestResult::miss()).unwrap()
    }

    /// Get flagged applications
    pub fn get_flagged(&self) -> JsValue {
        let flagged: Vec<_> = self.data.iter()
            .filter(|d| d.variance > self.variance_threshold)
            .map(|d| serde_json::json!({
                "applicationId": d.application_id,
                "reference": d.reference,
                "variance": d.variance,
                "mean": d.mean,
                "scores": d.scores
            }))
            .collect();

        serde_wasm_bindgen::to_value(&flagged).unwrap()
    }

    /// Get statistics
    pub fn get_stats(&self) -> JsValue {
        let total_count = self.data.len();
        let flagged_count = self.data.iter().filter(|d| d.flagged).count();
        let avg_variance = if total_count > 0 {
            self.data.iter().map(|d| d.variance).sum::<f64>() / total_count as f64
        } else {
            0.0
        };

        let stats = serde_json::json!({
            "totalApplications": total_count,
            "flaggedCount": flagged_count,
            "flaggedPercentage": if total_count > 0 { (flagged_count as f64 / total_count as f64) * 100.0 } else { 0.0 },
            "averageVariance": avg_variance,
            "varianceThreshold": self.variance_threshold,
            "maxAssessors": self.max_assessors
        });
        serde_wasm_bindgen::to_value(&stats).unwrap()
    }
}
