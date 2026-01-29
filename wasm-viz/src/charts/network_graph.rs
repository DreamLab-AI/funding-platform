//! Network Graph Visualization
//!
//! Interactive force-directed graph showing assessor-application assignment relationships.
//! Supports pan, zoom, and node selection for exploring the assignment network.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use web_sys::CanvasRenderingContext2d;
use std::f64::consts::PI;

use super::common::{get_canvas_context, clear_canvas, ChartConfig, HitTestResult};

/// Node types in the network
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum NodeType {
    #[serde(rename = "assessor")]
    Assessor,
    #[serde(rename = "application")]
    Application,
}

/// Network node
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkNode {
    pub id: String,
    pub label: String,
    pub node_type: NodeType,
    pub size: Option<f64>,
    pub color: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// Network edge (assignment link)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkEdge {
    pub source: String,
    pub target: String,
    pub weight: Option<f64>,
    pub color: Option<String>,
    pub status: Option<String>, // "pending", "in_progress", "completed"
}

/// Internal node with physics state
#[derive(Clone, Debug)]
struct PhysicsNode {
    id: String,
    label: String,
    node_type: NodeType,
    x: f64,
    y: f64,
    vx: f64,
    vy: f64,
    size: f64,
    color: String,
    fixed: bool,
    metadata: Option<serde_json::Value>,
}

/// Network graph with force-directed layout
#[wasm_bindgen]
pub struct NetworkGraphChart {
    canvas_id: String,
    config: ChartConfig,
    nodes: Vec<PhysicsNode>,
    edges: Vec<NetworkEdge>,
    // View state
    zoom: f64,
    pan_x: f64,
    pan_y: f64,
    // Interaction state
    dragging_node: Option<usize>,
    hovered_node: Option<usize>,
    selected_nodes: Vec<usize>,
    // Physics settings
    simulation_running: bool,
    repulsion_strength: f64,
    attraction_strength: f64,
    damping: f64,
    center_gravity: f64,
}

#[wasm_bindgen]
impl NetworkGraphChart {
    /// Create a new network graph chart
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str, config_js: JsValue) -> Result<NetworkGraphChart, JsValue> {
        let config: ChartConfig = serde_wasm_bindgen::from_value(config_js)
            .unwrap_or_else(|_| ChartConfig::default());

        Ok(Self {
            canvas_id: canvas_id.to_string(),
            config,
            nodes: Vec::new(),
            edges: Vec::new(),
            zoom: 1.0,
            pan_x: 0.0,
            pan_y: 0.0,
            dragging_node: None,
            hovered_node: None,
            selected_nodes: Vec::new(),
            simulation_running: true,
            repulsion_strength: 500.0,
            attraction_strength: 0.05,
            damping: 0.9,
            center_gravity: 0.02,
        })
    }

    /// Set graph data
    pub fn set_data(&mut self, nodes_js: JsValue, edges_js: JsValue) -> Result<(), JsValue> {
        let nodes: Vec<NetworkNode> = serde_wasm_bindgen::from_value(nodes_js)?;
        let edges: Vec<NetworkEdge> = serde_wasm_bindgen::from_value(edges_js)?;

        // Initialize physics nodes with random positions in a circle
        let center_x = self.config.width / 2.0;
        let center_y = self.config.height / 2.0;
        let radius = (self.config.width.min(self.config.height) / 3.0).max(100.0);

        self.nodes = nodes.iter().enumerate().map(|(i, node)| {
            let angle = (i as f64 / nodes.len() as f64) * 2.0 * PI;

            // Assessors in inner ring, applications in outer ring
            let r = match node.node_type {
                NodeType::Assessor => radius * 0.4,
                NodeType::Application => radius * 0.9,
            };

            PhysicsNode {
                id: node.id.clone(),
                label: node.label.clone(),
                node_type: node.node_type.clone(),
                x: center_x + r * angle.cos() + (rand_float() - 0.5) * 50.0,
                y: center_y + r * angle.sin() + (rand_float() - 0.5) * 50.0,
                vx: 0.0,
                vy: 0.0,
                size: node.size.unwrap_or(match node.node_type {
                    NodeType::Assessor => 20.0,
                    NodeType::Application => 12.0,
                }),
                color: node.color.clone().unwrap_or_else(|| match node.node_type {
                    NodeType::Assessor => self.config.theme.primary.clone(),
                    NodeType::Application => self.config.theme.secondary.clone(),
                }),
                fixed: false,
                metadata: node.metadata.clone(),
            }
        }).collect();

        self.edges = edges;
        self.simulation_running = true;

        Ok(())
    }

    /// Configure physics simulation
    pub fn set_physics(&mut self, repulsion: f64, attraction: f64, damping: f64) {
        self.repulsion_strength = repulsion;
        self.attraction_strength = attraction;
        self.damping = damping;
    }

    /// Toggle simulation
    pub fn toggle_simulation(&mut self) -> bool {
        self.simulation_running = !self.simulation_running;
        self.simulation_running
    }

    /// Step physics simulation
    pub fn step_simulation(&mut self) -> bool {
        if !self.simulation_running || self.nodes.is_empty() {
            return false;
        }

        let center_x = self.config.width / 2.0;
        let center_y = self.config.height / 2.0;

        // Calculate forces
        let n = self.nodes.len();
        let mut forces: Vec<(f64, f64)> = vec![(0.0, 0.0); n];

        // Repulsion between all nodes
        for i in 0..n {
            for j in (i + 1)..n {
                let dx = self.nodes[j].x - self.nodes[i].x;
                let dy = self.nodes[j].y - self.nodes[i].y;
                let dist_sq = dx * dx + dy * dy;
                let dist = dist_sq.sqrt().max(1.0);

                let force = self.repulsion_strength / dist_sq;
                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;

                forces[i].0 -= fx;
                forces[i].1 -= fy;
                forces[j].0 += fx;
                forces[j].1 += fy;
            }
        }

        // Attraction along edges
        for edge in &self.edges {
            let source_idx = self.nodes.iter().position(|n| n.id == edge.source);
            let target_idx = self.nodes.iter().position(|n| n.id == edge.target);

            if let (Some(s), Some(t)) = (source_idx, target_idx) {
                let dx = self.nodes[t].x - self.nodes[s].x;
                let dy = self.nodes[t].y - self.nodes[s].y;
                let dist = (dx * dx + dy * dy).sqrt().max(1.0);

                let weight = edge.weight.unwrap_or(1.0);
                let force = self.attraction_strength * dist * weight;
                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;

                forces[s].0 += fx;
                forces[s].1 += fy;
                forces[t].0 -= fx;
                forces[t].1 -= fy;
            }
        }

        // Center gravity
        for i in 0..n {
            let dx = center_x - self.nodes[i].x;
            let dy = center_y - self.nodes[i].y;
            forces[i].0 += dx * self.center_gravity;
            forces[i].1 += dy * self.center_gravity;
        }

        // Apply forces and update positions
        let mut total_movement = 0.0;

        for i in 0..n {
            if self.nodes[i].fixed || self.dragging_node == Some(i) {
                continue;
            }

            self.nodes[i].vx = (self.nodes[i].vx + forces[i].0) * self.damping;
            self.nodes[i].vy = (self.nodes[i].vy + forces[i].1) * self.damping;

            // Limit velocity
            let speed = (self.nodes[i].vx * self.nodes[i].vx + self.nodes[i].vy * self.nodes[i].vy).sqrt();
            if speed > 10.0 {
                self.nodes[i].vx = (self.nodes[i].vx / speed) * 10.0;
                self.nodes[i].vy = (self.nodes[i].vy / speed) * 10.0;
            }

            self.nodes[i].x += self.nodes[i].vx;
            self.nodes[i].y += self.nodes[i].vy;

            total_movement += speed;
        }

        // Stop simulation when movement is minimal
        if total_movement < 0.5 {
            self.simulation_running = false;
        }

        true
    }

    /// Render the graph
    pub fn render(&self) -> Result<(), JsValue> {
        let (canvas, ctx) = get_canvas_context(&self.canvas_id)?;

        canvas.set_width(self.config.width as u32);
        canvas.set_height(self.config.height as u32);

        clear_canvas(&ctx, self.config.width, self.config.height, &self.config.theme.background);

        if self.nodes.is_empty() {
            self.draw_empty_state(&ctx)?;
            return Ok(());
        }

        // Apply zoom and pan transform
        ctx.save();
        ctx.translate(self.pan_x, self.pan_y)?;
        ctx.scale(self.zoom, self.zoom)?;

        // Draw edges first (behind nodes)
        self.draw_edges(&ctx)?;

        // Draw nodes
        self.draw_nodes(&ctx)?;

        ctx.restore();

        // Draw UI overlay
        self.draw_overlay(&ctx)?;

        Ok(())
    }

    fn draw_edges(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        for edge in &self.edges {
            let source = self.nodes.iter().find(|n| n.id == edge.source);
            let target = self.nodes.iter().find(|n| n.id == edge.target);

            if let (Some(s), Some(t)) = (source, target) {
                // Determine color based on status
                let color = edge.color.clone().unwrap_or_else(|| {
                    match edge.status.as_deref() {
                        Some("completed") => self.config.theme.success.clone(),
                        Some("in_progress") => self.config.theme.warning.clone(),
                        _ => self.config.theme.grid.clone(),
                    }
                });

                ctx.set_stroke_style(&JsValue::from_str(&color));
                ctx.set_line_width(edge.weight.unwrap_or(1.0).max(0.5));

                // Draw curved edge
                let mid_x = (s.x + t.x) / 2.0;
                let mid_y = (s.y + t.y) / 2.0;
                let dx = t.x - s.x;
                let dy = t.y - s.y;
                let perpx = -dy * 0.1;
                let perpy = dx * 0.1;

                ctx.begin_path();
                ctx.move_to(s.x, s.y);
                ctx.quadratic_curve_to(mid_x + perpx, mid_y + perpy, t.x, t.y);
                ctx.stroke();

                // Draw arrow at target
                let angle = (t.y - (mid_y + perpy)).atan2(t.x - (mid_x + perpx));
                let arrow_size = 6.0;
                let arrow_x = t.x - t.size * angle.cos();
                let arrow_y = t.y - t.size * angle.sin();

                ctx.set_fill_style(&JsValue::from_str(&color));
                ctx.begin_path();
                ctx.move_to(arrow_x, arrow_y);
                ctx.line_to(
                    arrow_x - arrow_size * (angle - 0.3).cos(),
                    arrow_y - arrow_size * (angle - 0.3).sin(),
                );
                ctx.line_to(
                    arrow_x - arrow_size * (angle + 0.3).cos(),
                    arrow_y - arrow_size * (angle + 0.3).sin(),
                );
                ctx.close_path();
                ctx.fill();
            }
        }

        Ok(())
    }

    fn draw_nodes(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        for (i, node) in self.nodes.iter().enumerate() {
            let is_hovered = self.hovered_node == Some(i);
            let is_selected = self.selected_nodes.contains(&i);

            // Node shape based on type
            match node.node_type {
                NodeType::Assessor => {
                    // Draw square for assessors
                    let size = node.size * if is_hovered { 1.2 } else { 1.0 };

                    if is_selected {
                        ctx.set_stroke_style(&JsValue::from_str(&self.config.theme.warning));
                        ctx.set_line_width(3.0);
                        ctx.stroke_rect(node.x - size - 2.0, node.y - size - 2.0, size * 2.0 + 4.0, size * 2.0 + 4.0);
                    }

                    ctx.set_fill_style(&JsValue::from_str(&node.color));
                    ctx.fill_rect(node.x - size, node.y - size, size * 2.0, size * 2.0);
                }
                NodeType::Application => {
                    // Draw circle for applications
                    let radius = node.size * if is_hovered { 1.2 } else { 1.0 };

                    if is_selected {
                        ctx.set_stroke_style(&JsValue::from_str(&self.config.theme.warning));
                        ctx.set_line_width(3.0);
                        ctx.begin_path();
                        ctx.arc(node.x, node.y, radius + 4.0, 0.0, 2.0 * PI)?;
                        ctx.stroke();
                    }

                    ctx.set_fill_style(&JsValue::from_str(&node.color));
                    ctx.begin_path();
                    ctx.arc(node.x, node.y, radius, 0.0, 2.0 * PI)?;
                    ctx.fill();
                }
            }

            // Draw label if zoomed in enough or hovered
            if self.zoom > 0.7 || is_hovered {
                ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
                ctx.set_font(&format!("{}px {}",
                    (self.config.font_size - 2.0) / self.zoom,
                    self.config.font_family
                ));
                ctx.set_text_align("center");

                let label = if node.label.len() > 15 {
                    format!("{}...", &node.label[..12])
                } else {
                    node.label.clone()
                };

                ctx.fill_text(&label, node.x, node.y + node.size + 15.0)?;
            }
        }

        Ok(())
    }

    fn draw_overlay(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        // Legend
        if self.config.show_legend {
            let legend_x = 20.0;
            let legend_y = 20.0;

            ctx.set_font(&format!("{}px {}", self.config.font_size - 1.0, self.config.font_family));
            ctx.set_text_align("left");

            // Assessor legend
            ctx.set_fill_style(&JsValue::from_str(&self.config.theme.primary));
            ctx.fill_rect(legend_x, legend_y - 8.0, 12.0, 12.0);
            ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
            ctx.fill_text("Assessor", legend_x + 18.0, legend_y)?;

            // Application legend
            ctx.set_fill_style(&JsValue::from_str(&self.config.theme.secondary));
            ctx.begin_path();
            ctx.arc(legend_x + 6.0, legend_y + 18.0, 6.0, 0.0, 2.0 * PI)?;
            ctx.fill();
            ctx.set_fill_style(&JsValue::from_str(&self.config.theme.text));
            ctx.fill_text("Application", legend_x + 18.0, legend_y + 22.0)?;
        }

        // Zoom indicator
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.secondary));
        ctx.set_font(&format!("{}px {}", self.config.font_size - 2.0, self.config.font_family));
        ctx.set_text_align("right");
        ctx.fill_text(
            &format!("Zoom: {:.0}%", self.zoom * 100.0),
            self.config.width - 20.0,
            self.config.height - 10.0,
        )?;

        // Node count
        let assessor_count = self.nodes.iter().filter(|n| n.node_type == NodeType::Assessor).count();
        let app_count = self.nodes.len() - assessor_count;
        ctx.fill_text(
            &format!("{} assessors, {} applications", assessor_count, app_count),
            self.config.width - 20.0,
            self.config.height - 25.0,
        )?;

        Ok(())
    }

    fn draw_empty_state(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        ctx.set_fill_style(&JsValue::from_str(&self.config.theme.secondary));
        ctx.set_font(&format!("{}px {}", self.config.font_size, self.config.font_family));
        ctx.set_text_align("center");
        ctx.fill_text(
            "No assignment data available",
            self.config.width / 2.0,
            self.config.height / 2.0,
        )?;
        Ok(())
    }

    /// Handle zoom
    pub fn on_zoom(&mut self, delta: f64, center_x: f64, center_y: f64) {
        let old_zoom = self.zoom;
        self.zoom = (self.zoom * (1.0 - delta * 0.001)).clamp(0.3, 3.0);

        // Adjust pan to zoom toward cursor
        let zoom_change = self.zoom / old_zoom;
        self.pan_x = center_x - (center_x - self.pan_x) * zoom_change;
        self.pan_y = center_y - (center_y - self.pan_y) * zoom_change;

        self.render().ok();
    }

    /// Handle pan
    pub fn on_pan(&mut self, dx: f64, dy: f64) {
        self.pan_x += dx;
        self.pan_y += dy;
        self.render().ok();
    }

    /// Handle mouse down
    pub fn on_mouse_down(&mut self, x: f64, y: f64) -> bool {
        // Transform coordinates
        let tx = (x - self.pan_x) / self.zoom;
        let ty = (y - self.pan_y) / self.zoom;

        // Check if clicking on a node
        for (i, node) in self.nodes.iter().enumerate() {
            let dx = tx - node.x;
            let dy = ty - node.y;
            let dist = (dx * dx + dy * dy).sqrt();

            if dist < node.size * 1.5 {
                self.dragging_node = Some(i);
                self.nodes[i].fixed = true;
                return true;
            }
        }

        false
    }

    /// Handle mouse up
    pub fn on_mouse_up(&mut self) {
        if let Some(idx) = self.dragging_node {
            self.nodes[idx].fixed = false;
        }
        self.dragging_node = None;
    }

    /// Handle mouse move
    pub fn on_mouse_move(&mut self, x: f64, y: f64) -> JsValue {
        // Transform coordinates
        let tx = (x - self.pan_x) / self.zoom;
        let ty = (y - self.pan_y) / self.zoom;

        // Handle dragging
        if let Some(idx) = self.dragging_node {
            self.nodes[idx].x = tx;
            self.nodes[idx].y = ty;
            self.render().ok();
            return serde_wasm_bindgen::to_value(&HitTestResult::miss()).unwrap();
        }

        // Check hover
        let old_hovered = self.hovered_node;

        for (i, node) in self.nodes.iter().enumerate() {
            let dx = tx - node.x;
            let dy = ty - node.y;
            let dist = (dx * dx + dy * dy).sqrt();

            if dist < node.size * 1.5 {
                self.hovered_node = Some(i);

                if old_hovered != self.hovered_node {
                    self.render().ok();
                }

                let result = HitTestResult::hit(
                    &node.id,
                    match node.node_type {
                        NodeType::Assessor => "assessor",
                        NodeType::Application => "application",
                    },
                    serde_json::json!({
                        "id": node.id,
                        "label": node.label,
                        "type": match node.node_type {
                            NodeType::Assessor => "assessor",
                            NodeType::Application => "application",
                        },
                        "metadata": node.metadata,
                        "connections": self.edges.iter()
                            .filter(|e| e.source == node.id || e.target == node.id)
                            .count()
                    }),
                );
                return serde_wasm_bindgen::to_value(&result).unwrap();
            }
        }

        self.hovered_node = None;
        if old_hovered.is_some() {
            self.render().ok();
        }

        serde_wasm_bindgen::to_value(&HitTestResult::miss()).unwrap()
    }

    /// Handle click for selection
    pub fn on_click(&mut self, x: f64, y: f64, multi_select: bool) -> JsValue {
        let tx = (x - self.pan_x) / self.zoom;
        let ty = (y - self.pan_y) / self.zoom;

        for (i, node) in self.nodes.iter().enumerate() {
            let dx = tx - node.x;
            let dy = ty - node.y;
            let dist = (dx * dx + dy * dy).sqrt();

            if dist < node.size * 1.5 {
                if multi_select {
                    if let Some(pos) = self.selected_nodes.iter().position(|&idx| idx == i) {
                        self.selected_nodes.remove(pos);
                    } else {
                        self.selected_nodes.push(i);
                    }
                } else {
                    self.selected_nodes = vec![i];
                }

                self.render().ok();

                return serde_wasm_bindgen::to_value(&serde_json::json!({
                    "selected": self.selected_nodes.iter().map(|&idx| &self.nodes[idx].id).collect::<Vec<_>>()
                })).unwrap();
            }
        }

        // Click on empty space clears selection
        if !multi_select {
            self.selected_nodes.clear();
            self.render().ok();
        }

        serde_wasm_bindgen::to_value(&serde_json::json!({ "selected": [] })).unwrap()
    }

    /// Get statistics
    pub fn get_stats(&self) -> JsValue {
        let assessor_count = self.nodes.iter().filter(|n| n.node_type == NodeType::Assessor).count();
        let app_count = self.nodes.len() - assessor_count;

        let stats = serde_json::json!({
            "nodeCount": self.nodes.len(),
            "edgeCount": self.edges.len(),
            "assessorCount": assessor_count,
            "applicationCount": app_count,
            "selectedCount": self.selected_nodes.len(),
            "zoom": self.zoom,
            "simulationRunning": self.simulation_running
        });
        serde_wasm_bindgen::to_value(&stats).unwrap()
    }

    /// Reset view to default
    pub fn reset_view(&mut self) {
        self.zoom = 1.0;
        self.pan_x = 0.0;
        self.pan_y = 0.0;
        self.selected_nodes.clear();
        self.render().ok();
    }

    /// Fit view to content
    pub fn fit_to_content(&mut self) {
        if self.nodes.is_empty() {
            return;
        }

        let min_x = self.nodes.iter().map(|n| n.x).fold(f64::INFINITY, f64::min);
        let max_x = self.nodes.iter().map(|n| n.x).fold(f64::NEG_INFINITY, f64::max);
        let min_y = self.nodes.iter().map(|n| n.y).fold(f64::INFINITY, f64::min);
        let max_y = self.nodes.iter().map(|n| n.y).fold(f64::NEG_INFINITY, f64::max);

        let content_width = max_x - min_x + 100.0;
        let content_height = max_y - min_y + 100.0;

        self.zoom = ((self.config.width / content_width).min(self.config.height / content_height) * 0.9).clamp(0.3, 2.0);

        self.pan_x = (self.config.width - content_width * self.zoom) / 2.0 - min_x * self.zoom + 50.0;
        self.pan_y = (self.config.height - content_height * self.zoom) / 2.0 - min_y * self.zoom + 50.0;

        self.render().ok();
    }
}

/// Simple pseudo-random number generator for initial positions
fn rand_float() -> f64 {
    use std::cell::RefCell;
    thread_local! {
        static SEED: RefCell<u64> = RefCell::new(12345);
    }

    SEED.with(|seed| {
        let mut s = seed.borrow_mut();
        *s = s.wrapping_mul(6364136223846793005).wrapping_add(1);
        (*s as f64) / (u64::MAX as f64)
    })
}
