import { useEffect, useRef, useState } from "react";
import {
  GameEngine,
  ThreeGameRenderer,
  areaOrder,
  areas,
  clamp,
  formations,
  heroStats,
  isMovementKey,
  skillKeys,
  upgradeCost,
  type AreaId,
  type EquipmentSlot,
  type HudState,
  type SkillKey
} from "./game";

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine>(new GameEngine());
  const [hud, setHud] = useState<HudState>(() => engineRef.current.snapshot());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = engineRef.current;
    const renderer = new ThreeGameRenderer(canvas, engine.state);
    let animationId = 0;
    let hudTimer = 0;

    const resize = () => {
      renderer.resize();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - engine.state.last) / 1000);
      engine.state.last = now;
      engine.update(dt);
      renderer.render();
      hudTimer += dt;
      if (hudTimer > 0.12) {
        hudTimer = 0;
        setHud(engine.snapshot());
      }
      animationId = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    animationId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const engine = engineRef.current;
      if (isMovementKey(event.key)) {
        event.preventDefault();
        engine.setMovement(event.key, true);
      }
      if (event.key >= "1" && event.key <= "4") {
        engine.selectHero(Number(event.key) - 1);
      }
      if (event.code === "Space") engine.toggleHold();
      if (event.key.toLowerCase() === "q") {
        engine.changeFormation();
      }
      const skillKey = event.key.toLowerCase() as SkillKey;
      if (skillKeys.includes(skillKey)) {
        event.preventDefault();
        engine.triggerSkill(skillKey);
      }
      setHud(engine.snapshot());
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!isMovementKey(event.key)) return;
      event.preventDefault();
      engine.setMovement(event.key, false);
      setHud(engine.snapshot());
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = engineRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) * (engine.state.view.w / rect.width),
      y: (event.clientY - rect.top) * (engine.state.view.h / rect.height)
    };
    engine.selectAt(point);
    setHud(engine.snapshot());
  };

  const selectHero = (index: number) => {
    const engine = engineRef.current;
    engine.selectHero(index);
    setHud(engine.snapshot());
  };

  const toggleHold = () => {
    const engine = engineRef.current;
    engine.toggleHold();
    setHud(engine.snapshot());
  };

  const changeFormation = () => {
    const engine = engineRef.current;
    engine.changeFormation();
    setHud(engine.snapshot());
  };

  const changeArea = (area: AreaId) => {
    const engine = engineRef.current;
    engine.changeArea(area);
    setHud(engine.snapshot());
  };

  const triggerSkill = (key: SkillKey) => {
    const engine = engineRef.current;
    engine.triggerSkill(key);
    setHud(engine.snapshot());
  };

  const enhanceEquipment = (slot: EquipmentSlot) => {
    const engine = engineRef.current;
    engine.enhanceEquipment(slot);
    setHud(engine.snapshot());
  };

  const selectedHero = hud.heroes[hud.selected];
  const selectedStats = heroStats(selectedHero);

  return (
    <main className="shell">
      <section className="stage-wrap" aria-label="game stage">
        <canvas ref={canvasRef} width={1280} height={720} onClick={handleCanvasClick} />
        <div className="topbar">
          <div>
            <p className="eyebrow">Arcadia Frontier</p>
            <h1>家門戦記</h1>
          </div>
          <div className="resource">
            <span>{areas[hud.area].name}</span>
            <span>Boss {hud.bossCount}</span>
            <strong>{hud.score}</strong>
          </div>
        </div>
        <div className="hud">
          <div className="party">
            {hud.heroes.map((hero, index) => (
              <button
                className={`member ${index === hud.selected ? "active" : ""}`}
                key={hero.name}
                onClick={() => selectHero(index)}
                type="button"
              >
                <span className="member-head">
                  <strong>{hero.name}</strong>
                  <span className="role">{hero.role}</span>
                </span>
                <span className="bar">
                  <span className="fill" style={{ width: `${clamp(hero.hp / heroStats(hero).maxHp, 0, 1) * 100}%` }} />
                </span>
                <span className="bar mana">
                  <span className="fill" style={{ width: `${clamp(hero.mp / heroStats(hero).maxMp, 0, 1) * 100}%` }} />
                </span>
              </button>
            ))}
          </div>
          <div className="controls">
            <button type="button" title="一時停止 / 再開" onClick={toggleHold}>
              {hud.paused ? "Resume" : "Hold"}
            </button>
            <button type="button" title="隊列変更" onClick={changeFormation}>
              {formations[hud.formation].name}
            </button>
            <div className="area-tabs" aria-label="エリア移動">
              {areaOrder.map((area) => (
                <button
                  className={hud.area === area ? "active" : ""}
                  key={area}
                  onClick={() => changeArea(area)}
                  title={areas[area].description}
                  type="button"
                >
                  {areas[area].name}
                </button>
              ))}
            </div>
            {hud.heroes[hud.selected].skills.map((skill) => {
              const cooldown = hud.heroes[hud.selected].skillCooldowns[skill.key];
              const disabled = cooldown > 0 || selectedHero.mp < skill.cost;
              return (
                <button
                  disabled={disabled}
                  key={skill.key}
                  onClick={() => triggerSkill(skill.key)}
                  title={`${skill.key.toUpperCase()} ${skill.name}`}
                  type="button"
                >
                  {skill.key.toUpperCase()} {cooldown > 0 ? Math.ceil(cooldown) : skill.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="panel">
        <div className="crest">A</div>
        <h2>アルカディア開拓団</h2>
        <p className="status">{hud.status}</p>
        <div className="equipment">
          <div className="equipment-head">
            <strong>{selectedHero.name}</strong>
            <span>ATK {selectedStats.attack} / HP {selectedStats.maxHp} / MP {selectedStats.maxMp}</span>
          </div>
          {(Object.keys(selectedHero.equipment) as EquipmentSlot[]).map((slot) => {
            const item = selectedHero.equipment[slot];
            return (
              <button className="equipment-item" key={slot} onClick={() => enhanceEquipment(slot)} type="button">
                <span>
                  {item.name} +{item.level}
                </span>
                <small>{upgradeCost(item)} pts</small>
              </button>
            );
          })}
        </div>
        <div className="log" aria-live="polite">
          {hud.logs.map((log, index) => (
            <p key={`${log}-${index}`}>{log}</p>
          ))}
        </div>
        <div className="help">
          <span>WASD</span> 移動
          <span>Click</span> 選択 / 移動
          <span>1-4</span> メンバー選択
          <span>Space</span> Hold
          <span>Q</span> 隊列変更
          <span>ERTY</span> スキル
        </div>
      </aside>
    </main>
  );
}

export default App;
