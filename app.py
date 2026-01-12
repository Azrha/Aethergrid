from pathlib import Path
import streamlit as st
from streamlit_autorefresh import st_autorefresh

from engine.compiler import compile_program
from engine.backend import get_backend, gpu_available
from engine.paradox import static_check
from engine.factory import seed_world
from engine.kernel import Kernel
from engine.render import render_view, color_rgb
from engine.sim import Simulation
from engine.worldpack import load_worldpack_json, worldpack_to_dsl, WorldPack

st.set_page_config(page_title="MYTHOS — Reality Compiler", layout="wide")

ROOT = Path(__file__).resolve().parent
EXAMPLES = sorted((ROOT / "examples").glob("*.law"))

def load_text(p: Path) -> str:
    return p.read_text(encoding="utf-8")

def _example_options():
    opts = [p.name for p in EXAMPLES]
    if "real_world.law" in opts:
        opts.remove("real_world.law")
        opts.insert(0, "real_world.law")
    return opts

if "src" not in st.session_state:
    st.session_state.src = load_text(EXAMPLES[0]) if EXAMPLES else ""
if "draft_src" not in st.session_state:
    st.session_state.draft_src = st.session_state.src
if "tick_ms" not in st.session_state:
    st.session_state.tick_ms = 60
if "seed" not in st.session_state:
    st.session_state.seed = 42
if "n" not in st.session_state:
    st.session_state.n = 140
if "run" not in st.session_state:
    st.session_state.run = False
if "kernel" not in st.session_state:
    st.session_state.kernel = None
if "kernel_key" not in st.session_state:
    st.session_state.kernel_key = None
if "use_gpu" not in st.session_state:
    st.session_state.use_gpu = False
if "sim" not in st.session_state:
    st.session_state.sim = None
if "record_snapshots" not in st.session_state:
    st.session_state.record_snapshots = False
if "snapshot_interval" not in st.session_state:
    st.session_state.snapshot_interval = 10
if "step_counter" not in st.session_state:
    st.session_state.step_counter = 0
if "spawn_profiles" not in st.session_state:
    st.session_state.spawn_profiles = None
if "active_pack_name" not in st.session_state:
    st.session_state.active_pack_name = None

st.title("MYTHOS — Reality Compiler")
st.caption("Write laws. Compile worlds. Observe emergence. Patch paradoxes.")

left, right = st.columns([0.9, 1.1], gap="large")

with left:
    st.subheader("Laws (DSL)")
    mode_tabs = st.tabs(["Realism", "Fantasy", "Time Travel", "Space", "Custom"])
    with mode_tabs[0]:
        st.caption("Grounded physics with collisions, drag, and stable integration.")
        realism_mode = st.selectbox("Preset", ["Physics Core", "Living World"], index=1)
        g = st.slider("Gravity", 0.05, 0.35, 0.18, 0.01)
        drag = st.slider("Air drag", 0.0, 0.05, 0.015, 0.001)
        restitution = st.slider("Bounce", 0.6, 0.98, 0.82, 0.01)
        collide = st.slider("Collision radius", 2.0, 5.0, 3.2, 0.1)
        population = st.slider("Life density", 0.4, 1.6, 1.0, 0.1)
        if st.button("Apply Realism preset"):
            if realism_mode == "Living World":
                pack = load_worldpack_json((ROOT / "examples/worldpacks/living_world.json").read_text(encoding="utf-8"))
                dsl = worldpack_to_dsl(pack)
                dsl = dsl.replace("const G = 0.18", f"const G = {g}")
                dsl = dsl.replace("drag(0.015)", f"drag({drag})")
                dsl = dsl.replace("collide(3.2, 0.86, 0.06)", f"collide({collide}, 0.86, 0.06)")
                dsl = dsl.replace("bounce(W, H, 0.82)", f"bounce(W, H, {restitution})")
                st.session_state.draft_src = dsl
                scaled = []
                for p in pack.profiles:
                    data = p.__dict__.copy()
                    data["count"] = max(1, int(data["count"] * population))
                    scaled.append(data)
                st.session_state.spawn_profiles = scaled
                st.session_state.active_pack_name = pack.name
                st.session_state.seed = pack.seed
            else:
                st.session_state.draft_src = "\n".join(
                    [
                        "const W = 320",
                        "const H = 200",
                        "const DT = 1.0",
                        f"const G = {g}",
                        "const MAX_SPEED = 5.0",
                        "const SUBSTEPS = 2",
                        "",
                        "law gravity priority 10",
                        "  when true",
                        "  do vy += G",
                        "end",
                        "",
                        "law air_drag priority 12",
                        "  when true",
                        f"  do drag({drag})",
                        "end",
                        "",
                        "law collisions priority 18",
                        "  when true",
                        f"  do collide({collide}, 0.86, 0.06)",
                        "end",
                        "",
                        "law bounds priority 20",
                        "  when true",
                        f"  do bounce(W, H, {restitution})",
                        "end",
                        "",
                        "law clamp priority 100",
                        "  when true",
                        "  do clamp_speed(MAX_SPEED)",
                        "end",
                        "",
                    ]
                )
                st.session_state.spawn_profiles = None
                st.session_state.active_pack_name = "Realism"
            st.session_state.kernel_key = None
    with mode_tabs[1]:
        st.caption("Magic motion, floating structures, and gentle chaos.")
        mana = st.slider("Magic lift", 0.05, 0.3, 0.16, 0.01)
        whimsy = st.slider("Whimsy", 0.0, 0.2, 0.08, 0.01)
        if st.button("Apply Fantasy preset"):
            pack = load_worldpack_json((ROOT / "examples/worldpacks/fantasy.json").read_text(encoding="utf-8"))
            dsl = worldpack_to_dsl(pack)
            dsl = dsl.replace("vy -= 0.16 * (0.5 + rand())", f"vy -= {mana} * (0.5 + rand())")
            dsl = dsl.replace("drag(0.012)", f"drag({0.012 + whimsy * 0.02:.3f})")
            st.session_state.draft_src = dsl
            st.session_state.spawn_profiles = [p.__dict__ for p in pack.profiles]
            st.session_state.active_pack_name = pack.name
            st.session_state.kernel_key = None
    with mode_tabs[2]:
        st.caption("Dinosaur era with herds, early settlements, and rugged terrain.")
        herd = st.slider("Herd motion", 0.02, 0.2, 0.08, 0.01)
        if st.button("Apply Time Travel preset"):
            pack = load_worldpack_json((ROOT / "examples/worldpacks/time_travel_dino.json").read_text(encoding="utf-8"))
            dsl = worldpack_to_dsl(pack)
            dsl = dsl.replace("vx += 0.08 * (rand() - 0.5)", f"vx += {herd} * (rand() - 0.5)")
            st.session_state.draft_src = dsl
            st.session_state.spawn_profiles = [p.__dict__ for p in pack.profiles]
            st.session_state.active_pack_name = pack.name
            st.session_state.kernel_key = None
    with mode_tabs[3]:
        st.caption("Deep space dynamics and orbit-like drift.")
        gravity = st.slider("Center pull", 0.0002, 0.002, 0.0008, 0.0001, format="%.4f")
        if st.button("Apply Space preset"):
            pack = load_worldpack_json((ROOT / "examples/worldpacks/space.json").read_text(encoding="utf-8"))
            dsl = worldpack_to_dsl(pack)
            dsl = dsl.replace("vx += (W/2 - x) * 0.0008", f"vx += (W/2 - x) * {gravity}")
            dsl = dsl.replace("vy += (H/2 - y) * 0.0008", f"vy += (H/2 - y) * {gravity}")
            st.session_state.draft_src = dsl
            st.session_state.spawn_profiles = [p.__dict__ for p in pack.profiles]
            st.session_state.active_pack_name = pack.name
            st.session_state.kernel_key = None
    with mode_tabs[4]:
        st.caption("Upload a WorldPack JSON to define custom lore, entities, and laws.")
        uploaded = st.file_uploader("Upload WorldPack (.json)", type=["json"])
        if uploaded:
            try:
                pack = load_worldpack_json(uploaded.read().decode("utf-8"))
                st.success(f"Loaded: {pack.name}")
                st.session_state.draft_src = worldpack_to_dsl(pack)
                st.session_state.spawn_profiles = [p.__dict__ for p in pack.profiles]
                st.session_state.active_pack_name = pack.name
                st.session_state.kernel_key = None
                st.caption(pack.description)
            except Exception as e:
                st.error(f"WorldPack error: {e}")
        st.markdown(
            "\n".join(
                [
                    "**WorldPack format (JSON)**",
                    "- name, description, seed",
                    "- consts (W, H, DT, G, MAX_SPEED, SUBSTEPS, ...)",
                    "- profiles (name, color, count, mass_range, hardness_range, speed_range, depth_range, static, energy_range, wealth_range)",
                    "- laws (name, priority, when, actions)",
                ]
            )
        )

    ex_opts = _example_options()
    ex = st.selectbox("Load raw .law example", options=ex_opts, index=0 if ex_opts else 0)
    if EXAMPLES and st.button("Load selected .law example"):
        p = next((x for x in EXAMPLES if x.name == ex), None)
        if p:
            st.session_state.draft_src = load_text(p)
            st.session_state.spawn_profiles = None
            st.session_state.active_pack_name = p.name
            st.session_state.kernel_key = None

    st.session_state.draft_src = st.text_area("Edit laws", value=st.session_state.draft_src, height=520)
    dirty = st.session_state.draft_src != st.session_state.src
    apply_cols = st.columns([0.5, 0.5])
    with apply_cols[0]:
        if st.button("Apply laws", disabled=not dirty):
            st.session_state.src = st.session_state.draft_src
            st.session_state.kernel_key = None
    with apply_cols[1]:
            st.caption("Unsaved changes" if dirty else "Laws are applied")

    st.divider()
    st.subheader("Export")
    st.download_button(
        "Download laws as .law",
        data=st.session_state.src.encode("utf-8"),
        file_name="mythos_world.law",
        mime="text/plain",
    )
    with st.expander("How to use Mythos", expanded=True):
        st.markdown(
            "\n".join(
                [
                    "- Pick a Simulation Mode tab (Realism/Fantasy/Time/Space/Custom), then apply the preset.",
                    "- For raw DSL, load an example and click `Apply laws`.",
                    "- Edit the DSL on the left; use `Apply laws` to recompile.",
                    "- Use `Run` to animate, `Step` for single ticks, and `Reset world` after changing seed/entities.",
                    "- Observer settings control what is \"seen\" by entities (affects some laws).",
                    "- Use Camera X/Y + Zoom to inspect regions; toggle Trails for motion clarity.",
                    "- Metrics and Export tabs capture performance and snapshots.",
                    "- Diagnostics show speed, sound, and paradox heat as you iterate.",
                ]
            )
        )
    with st.expander("DSL quick reference", expanded=False):
        st.markdown(
            "\n".join(
                [
                    "- Fields: `x y z vx vy vz mass hardness color age seen alive sound energy wealth terrain water fertility season climate rain latitude`",
                    "- Effects: `x += expr`, `y += expr`, `vx += expr`, `vy += expr`",
                    "- Calls: `emit_sound(expr)`, `attract(r,s,selector)`, `repel(r,s,selector)`",
                    "- Calls: `decay_unseen(rate)`, `fade_color(rate)`, `clamp_speed(max)`",
                    "- Calls: `drag(rate)`, `bounce([W,H,restitution])`, `collide([r,rest,fric])`",
                    "- Calls: `wander(strength)`, `seek(x,y,str)`, `avoid(x,y,str)`",
                    "- Calls: `cohere(r,s,selector)`, `align(r,s,selector)`, `separate(r,s,selector)`",
                    "- Calls: `emit_food(amt)`, `consume_food(rate,gain)`, `metabolize(rate)`",
                    "- Calls: `wind(strength)`, `gust(strength)`",
                    "- Calls: `emit_water(amt)`, `consume_water(rate,gain)`",
                    "- Calls: `emit_road(amt)`, `follow_road(str)`, `emit_settlement(amt)`",
                    "- Calls: `emit_home(amt)`, `emit_farm(amt)`, `emit_market(amt)`",
                    "- Calls: `seek_home(str)`, `seek_farm(str)`, `seek_market(str)`",
                    "- Calls: `trade(rate)`",
                    "- Calls: `wrap(W,H)`",
                ]
            )
        )

with right:
    st.subheader("World")
    status = st.empty()
    img_box = st.empty()
    diag = st.empty()

    try:
        prog = compile_program(st.session_state.src)
        rep = static_check(prog.consts, prog.laws)
        if rep.static_errors:
            status.error("Static errors:\n- " + "\n- ".join(rep.static_errors))
            st.stop()
        if rep.warnings:
            status.warning("Warnings:\n- " + "\n- ".join(rep.warnings))
        else:
            status.success("Compiled OK")

        with st.sidebar:
            st.subheader("Simulation")
            st.session_state.run = st.toggle("Run", value=st.session_state.run)
            steps = st.slider("Steps per frame", 1, 10, 2)
            st.session_state.tick_ms = st.number_input(
                "Tick ms",
                min_value=10,
                max_value=500,
                value=int(st.session_state.tick_ms),
            )
            st.subheader("World Settings")
            st.session_state.seed = st.number_input(
                "Seed",
                min_value=0,
                max_value=999999,
                value=int(st.session_state.seed),
            )
            st.session_state.n = st.number_input(
                "Entities",
                min_value=10,
                max_value=600,
                value=int(st.session_state.n),
            )
            if st.session_state.active_pack_name:
                st.caption(f"WorldPack: {st.session_state.active_pack_name}")
            st.subheader("Compute")
            st.session_state.use_gpu = st.checkbox(
                "GPU acceleration (requires CuPy)",
                value=st.session_state.use_gpu,
            )
            if st.session_state.use_gpu and not gpu_available():
                st.warning("GPU backend not available; falling back to CPU.")
            st.session_state.record_snapshots = st.checkbox(
                "Record snapshots",
                value=st.session_state.record_snapshots,
            )
            st.session_state.snapshot_interval = st.number_input(
                "Snapshot interval (steps)",
                min_value=1,
                max_value=200,
                value=int(st.session_state.snapshot_interval),
            )
            reset_clicked = st.button("Reset world")
            st.subheader("Observer")
            observer = st.checkbox("Observer active", value=True)

        backend = get_backend(st.session_state.use_gpu)
        kernel_key = (
            st.session_state.src,
            int(st.session_state.seed),
            int(st.session_state.n),
            backend.name,
        )
        if reset_clicked or st.session_state.kernel is None or st.session_state.kernel_key != kernel_key:
            # seed then let Kernel apply consts (W/H/DT/MAX_SPEED)
            world = seed_world(
                256,
                256,
                n=int(st.session_state.n),
                seed=int(st.session_state.seed),
                backend=backend,
                profiles=st.session_state.spawn_profiles,
            )
            kernel = Kernel(world, prog.consts, prog.laws)

            # re-seed with final dimensions
            W, H = kernel.world.w, kernel.world.h
            DT = kernel.world.dt
            world = seed_world(
                W,
                H,
                n=int(st.session_state.n),
                seed=int(st.session_state.seed),
                backend=backend,
                profiles=st.session_state.spawn_profiles,
            )
            world.dt = DT
            kernel = Kernel(world, prog.consts, prog.laws)

            st.session_state.kernel = kernel
            st.session_state.kernel_key = kernel_key
            st.session_state.sim = Simulation(kernel)
            st.session_state.step_counter = 0
        else:
            kernel = st.session_state.kernel
        sim = st.session_state.sim or Simulation(kernel)

        W, H = kernel.world.w, kernel.world.h
        tabs = st.tabs(["World", "Metrics", "Export"])
        with tabs[0]:
            ox = st.slider("Observer X", 0, W - 1, W // 2)
            oy = st.slider("Observer Y", 0, H - 1, H // 2)
            rad = st.slider("Observer radius", 10, 120, 55)

            show_sound = st.checkbox("Show sound field", value=True)
            show_food = st.checkbox("Show food field", value=True)
            show_paradox = st.checkbox("Show paradox heat", value=True)
            show_trails = st.checkbox("Show trails", value=True)
            show_atmosphere = st.checkbox("Show atmosphere", value=True)
            show_terrain = st.checkbox("Show terrain", value=True)
            show_water = st.checkbox("Show water", value=True)
            show_fertility = st.checkbox("Show fertility", value=False)
            show_roads = st.checkbox("Show roads", value=False)
            show_settlements = st.checkbox("Show settlements", value=False)
            show_homes = st.checkbox("Show homes", value=False)
            show_farms = st.checkbox("Show farms", value=False)
            show_markets = st.checkbox("Show markets", value=False)

            cam_cols = st.columns(3)
            with cam_cols[0]:
                cam_x = st.number_input("Camera X", min_value=0, max_value=W - 1, value=W // 2)
            with cam_cols[1]:
                cam_y = st.number_input("Camera Y", min_value=0, max_value=H - 1, value=H // 2)
            with cam_cols[2]:
                zoom = st.slider("Zoom", 0.5, 4.0, 1.0, 0.1)
            quality = st.selectbox("Render quality", ["Crisp", "Smooth", "Ultra"], index=0)
            resample = {"Crisp": "nearest", "Smooth": "bilinear", "Ultra": "lanczos"}[quality]
            render_mode = st.selectbox("Render mode", ["2D", "3D"], index=0)
            depth_scale = st.slider("Depth scale", 10, 140, 60, 5)

            step_once = st.button("Step")
            if st.session_state.run or step_once:
                sim.step(
                    steps if st.session_state.run else 1,
                    observer_xy=(ox, oy) if observer else None,
                    observer_radius=int(rad),
                )
                if st.session_state.record_snapshots:
                    st.session_state.step_counter += steps if st.session_state.run else 1
                    if st.session_state.step_counter >= int(st.session_state.snapshot_interval):
                        sim.capture_snapshot(max_entities=500)
                        st.session_state.step_counter = 0
                if st.session_state.run:
                    st_autorefresh(interval=int(st.session_state.tick_ms), key="sim_refresh")

            alive_ct = sum(1 for e in kernel.world.entities if e.alive)
            if render_mode == "3D":
                import plotly.graph_objects as go

                xs = []
                ys = []
                zs = []
                colors = []
                sizes = []
                for e in kernel.world.entities:
                    if not e.alive:
                        continue
                    xs.append(e.x)
                    ys.append(e.y)
                    zs.append(e.z * (depth_scale / 10.0))
                    r, g, b = color_rgb(e.color)
                    colors.append(f"rgb({r},{g},{b})")
                    sizes.append(max(4, min(10, 4 + e.hardness)))
                fig = go.Figure(
                    data=[
                        go.Scatter3d(
                            x=xs,
                            y=ys,
                            z=zs,
                            mode="markers",
                            marker=dict(size=sizes, color=colors, opacity=0.85),
                        )
                    ]
                )
                fig.update_layout(
                    scene=dict(
                        xaxis_title="X",
                        yaxis_title="Y",
                        zaxis_title="Z",
                        xaxis=dict(range=[0, W]),
                        yaxis=dict(range=[0, H]),
                    ),
                    height=560,
                    margin=dict(l=0, r=0, t=10, b=0),
                )
                img_box.plotly_chart(fig, use_container_width=True)
            else:
                im = render_view(
                    kernel.world,
                    center_x=cam_x,
                    center_y=cam_y,
                    zoom=zoom,
                    view_w=720,
                    view_h=520,
                    show_sound=show_sound,
                    show_paradox=show_paradox,
                    show_trails=show_trails,
                    show_atmosphere=show_atmosphere,
                    show_food=show_food,
                    show_terrain=show_terrain,
                    show_water=show_water,
                    show_fertility=show_fertility,
                    show_roads=show_roads,
                    show_settlements=show_settlements,
                    show_homes=show_homes,
                    show_farms=show_farms,
                    show_markets=show_markets,
                    resample=resample,
                )
                img_box.image(
                    im,
                    caption=f"t={kernel.world.time:.1f}  alive={alive_ct}/{len(kernel.world.entities)}  MAX_SPEED={kernel.cfg.max_speed:.2f}",
                    use_container_width=True,
                )

            alive = [e for e in kernel.world.entities if e.alive]
            if alive:
                vmax = max((e.vx * e.vx + e.vy * e.vy) ** 0.5 for e in alive)
                smax = max(e.sound for e in alive)
                hmax = max(e.hardness for e in alive)
            else:
                vmax = smax = hmax = 0.0

            diag.info(
                "\n".join(
                    [
                        f"World: {W}×{H}  dt={kernel.world.dt}",
                        f"Alive: {len(alive)}/{len(kernel.world.entities)}",
                        f"vmax={vmax:.3f}  sound_max={smax:.3f}  hardness_max={hmax:.3f}",
                        "If paradox heat rises, your laws are fighting or exploding.",
                    ]
                )
            )

        with tabs[1]:
            metrics = sim.metrics[-200:]
            if metrics:
                st.line_chart(
                    {
                        "elapsed_ms": [m["elapsed_ms"] for m in metrics],
                        "steps": [m["steps"] for m in metrics],
                    }
                )
            else:
                st.info("No metrics yet. Run the simulation to collect frame timings.")
            if sim.snapshots:
                idx = st.slider("Snapshot index", 0, len(sim.snapshots) - 1, len(sim.snapshots) - 1)
                st.json(sim.snapshots[idx], expanded=False)

        with tabs[2]:
            snap = sim.snapshot(max_entities=500)
            metrics = sim.metrics[-500:]
            if metrics:
                csv_lines = ["t,steps,elapsed_ms"]
                csv_lines.extend([f"{m['t']},{m['steps']},{m['elapsed_ms']:.4f}" for m in metrics])
                st.download_button(
                    "Download metrics (CSV)",
                    data="\n".join(csv_lines),
                    file_name="mythos_metrics.csv",
                    mime="text/csv",
                )
            if sim.snapshots:
                st.download_button(
                    "Download snapshot history (JSONL)",
                    data=sim.snapshots_jsonl(),
                    file_name="mythos_snapshots.jsonl",
                    mime="application/jsonl",
                )
            st.download_button(
                "Download snapshot (JSON)",
                data=sim.snapshot_json(max_entities=500),
                file_name="mythos_snapshot.json",
                mime="application/json",
            )
            st.json(snap, expanded=False)

    except Exception as e:
        status.error(f"Compile/runtime error: {e}")
        st.stop()
