import { useEffect, useRef, useState } from "react";
import {
  GameEngine,
  ThreeGameRenderer,
  areaOrder,
  areas,
  clamp,
  consumableCatalog,
  elementColors,
  elementLabels,
  equipmentCatalog,
  formations,
  heroStats,
  isMovementKey,
  shopOrder,
  shops,
  skillKeys,
  upgradeCost,
  type AreaId,
  type ConsumableId,
  type EquipmentSlot,
  type HudState,
  type ShopId,
  type SkillKey
} from "./game";

type Screen = "title" | "barracks" | "game";

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ThreeGameRenderer | null>(null);
  const cameraDragRef = useRef({ active: false, dragged: false, lastX: 0, lastY: 0, startX: 0, startY: 0 });
  const suppressCanvasClickRef = useRef(false);
  const engineRef = useRef<GameEngine>(new GameEngine());
  const [hud, setHud] = useState<HudState>(() => engineRef.current.snapshot());
  const [screen, setScreen] = useState<Screen>("title");
  const [selectedBarracksSlot, setSelectedBarracksSlot] = useState(0);
  const started = screen === "game";
  const startedRef = useRef(started);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = engineRef.current;
    const renderer = new ThreeGameRenderer(canvas, engine.state);
    rendererRef.current = renderer;
    let animationId = 0;
    let hudTimer = 0;

    const resize = () => {
      renderer.resize();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - engine.state.last) / 1000);
      engine.state.last = now;
      if (startedRef.current) engine.update(dt);
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
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!started) {
        if (event.key === "Enter" || event.code === "Space") {
          event.preventDefault();
          setScreen("game");
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setScreen("title");
        }
        return;
      }
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
      if (!started) return;
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
  }, [started]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!started) return;
    if (suppressCanvasClickRef.current) {
      suppressCanvasClickRef.current = false;
      return;
    }
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

  const handleCanvasWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (!started) return;
    event.preventDefault();
    rendererRef.current?.zoomBy(event.deltaY);
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!started || event.button !== 0) return;
    suppressCanvasClickRef.current = false;
    cameraDragRef.current = {
      active: true,
      dragged: false,
      lastX: event.clientX,
      lastY: event.clientY,
      startX: event.clientX,
      startY: event.clientY
    };
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = cameraDragRef.current;
    if (!started || !drag.active) return;
    const totalDistance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (totalDistance < 4 && !drag.dragged) return;
    drag.dragged = true;
    rendererRef.current?.rotateCamera(event.clientX - drag.lastX, event.clientY - drag.lastY);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    suppressCanvasClickRef.current = true;
  };

  const stopCanvasDrag = () => {
    if (cameraDragRef.current.dragged) suppressCanvasClickRef.current = true;
    cameraDragRef.current.active = false;
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

  const useShop = (shop: ShopId) => {
    const engine = engineRef.current;
    engine.useTownShop(shop);
    setHud(engine.snapshot());
  };

  const buyEquipment = (itemId: string) => {
    const engine = engineRef.current;
    engine.buyEquipment(itemId);
    setHud(engine.snapshot());
  };

  const equipInventoryItem = (index: number) => {
    const engine = engineRef.current;
    engine.equipInventoryItem(index);
    setHud(engine.snapshot());
  };

  const buyConsumable = (itemId: ConsumableId) => {
    const engine = engineRef.current;
    engine.buyConsumable(itemId);
    setHud(engine.snapshot());
  };

  const useConsumable = (itemId: ConsumableId) => {
    const engine = engineRef.current;
    engine.useConsumable(itemId);
    setHud(engine.snapshot());
  };

  const openBarracks = () => {
    setSelectedBarracksSlot(Math.min(selectedBarracksSlot, hud.heroes.length - 1));
    setScreen("barracks");
    setHud(engineRef.current.snapshot());
  };

  const swapFromReserve = (reserveIndex: number) => {
    const engine = engineRef.current;
    engine.swapPartyMember(selectedBarracksSlot, reserveIndex);
    setHud(engine.snapshot());
  };

  const selectedHero = hud.heroes[hud.selected];
  const selectedStats = heroStats(selectedHero);

  return (
    <main className="shell">
      <section className="stage-wrap" aria-label="game stage">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseLeave={stopCanvasDrag}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={stopCanvasDrag}
          onWheel={handleCanvasWheel}
        />
        {screen === "title" && (
          <div className="title-screen">
            <div className="title-mark">A</div>
            <p className="eyebrow">Arcadia Frontier</p>
            <h1>家門戦記</h1>
            <p className="title-copy">4人の家門を率いて、町で備え、フィールドとダンジョンを攻略する。</p>
            <div className="title-actions">
              <button type="button" onClick={() => setScreen("game")}>
                Start
              </button>
              <button type="button" onClick={openBarracks}>
                バラック
              </button>
              <span>Enter / Space</span>
            </div>
          </div>
        )}
        {screen === "barracks" && (
          <div className="barracks-screen">
            <div className="barracks-head">
              <p className="eyebrow">バラック</p>
              <h1>バラック</h1>
              <p>出撃枠を選んでから、控えメンバーを選ぶと入れ替わります。</p>
            </div>
            <div className="barracks-grid">
              <section className="barracks-list" aria-label="出撃メンバー">
                <h2>出撃メンバー</h2>
                {hud.heroes.map((hero, index) => {
                  const stats = heroStats(hero);
                  return (
                    <button
                      className={`barracks-card ${index === selectedBarracksSlot ? "active" : ""}`}
                      key={`${hero.name}-${index}`}
                      onClick={() => setSelectedBarracksSlot(index)}
                      type="button"
                    >
                      <strong>
                        {index + 1}. {hero.name}
                      </strong>
                      <span>{hero.role}</span>
                      <span style={{ color: elementColors[hero.element] }}>属性 {elementLabels[hero.element]}</span>
                      <small>
                        Lv {hero.level} / HP {Math.ceil(hero.hp)}/{stats.maxHp} / ATK {stats.attack}
                      </small>
                      <small>
                        STR {hero.str} / VIT {hero.vit} / AGI {hero.agi} / INT {hero.int} / MEN {hero.men} / DEX {hero.dex}
                      </small>
                    </button>
                  );
                })}
              </section>
              <section className="barracks-list" aria-label="控えメンバー">
                <h2>控えメンバー</h2>
                {hud.reserveHeroes.map((hero, index) => {
                  const stats = heroStats(hero);
                  return (
                    <button className="barracks-card" key={`${hero.name}-${index}`} onClick={() => swapFromReserve(index)} type="button">
                      <strong>{hero.name}</strong>
                      <span>{hero.role}</span>
                      <span style={{ color: elementColors[hero.element] }}>属性 {elementLabels[hero.element]}</span>
                      <small>
                        Lv {hero.level} / HP {Math.ceil(hero.hp)}/{stats.maxHp} / ATK {stats.attack}
                      </small>
                      <small>
                        STR {hero.str} / VIT {hero.vit} / AGI {hero.agi} / INT {hero.int} / MEN {hero.men} / DEX {hero.dex}
                      </small>
                    </button>
                  );
                })}
              </section>
            </div>
            <div className="title-actions">
              <button type="button" onClick={() => setScreen("game")}>
                Start
              </button>
              <button type="button" onClick={() => setScreen("title")}>
                Title
              </button>
              <span>Escでタイトルへ</span>
            </div>
          </div>
        )}
        <div className="topbar">
          <div>
            <p className="eyebrow">Arcadia Frontier</p>
            <h1>家門戦記</h1>
          </div>
          <div className="resource">
            <span>{areas[hud.area].name}</span>
            <span>Boss {hud.bossCount}</span>
            <span>Gold {hud.gold}</span>
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
                  <span className="role">Lv {hero.level}</span>
                </span>
                <span className="member-meta">
                  {hero.role} / {elementLabels[hero.element]}
                </span>
                <span className="bar">
                  <span className="fill" style={{ width: `${clamp(hero.hp / heroStats(hero).maxHp, 0, 1) * 100}%` }} />
                </span>
                <span className="bar mana">
                  <span className="fill" style={{ width: `${clamp(hero.mp / heroStats(hero).maxMp, 0, 1) * 100}%` }} />
                </span>
                <span className="bar exp">
                  <span className="fill" style={{ width: `${clamp(hero.exp / hero.nextExp, 0, 1) * 100}%` }} />
                </span>
              </button>
            ))}
          </div>
          <div className="controls">
            <button type="button" title="バラック" onClick={openBarracks}>
              バラック
            </button>
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
        {hud.area === "town" && (
          <div className="town-shops">
            {shopOrder.map((shop) => {
              const service = shops[shop];
              const cost =
                shop === "weapon"
                  ? upgradeCost(selectedHero.equipment.weapon)
                  : shop === "armor"
                    ? upgradeCost(selectedHero.equipment.armor)
                    : service.cost;
              return (
                <button className="shop-card" key={shop} onClick={() => useShop(shop)} type="button">
                  <span>
                    <strong>{service.name}</strong>
                    <small>{service.description}</small>
                  </span>
                  <b>{cost} gold</b>
                </button>
              );
            })}
          </div>
        )}
        {hud.area === "town" && (
          <div className="shop-stock">
            <div className="equipment-head">
              <strong>販売装備</strong>
              <span>購入すると所持装備に入ります</span>
            </div>
            {equipmentCatalog.map((item) => (
              <button className="equipment-item" key={item.id} onClick={() => buyEquipment(item.id)} type="button">
                <span>
                  {item.name} <small>{item.slot}</small>
                </span>
                <small>{item.price} gold</small>
              </button>
            ))}
          </div>
        )}
        {hud.area === "town" && (
          <div className="shop-stock">
            <div className="equipment-head">
              <strong>道具屋の商品</strong>
              <span>ポーションを購入できます</span>
            </div>
            {consumableCatalog.map((item) => (
              <button className="equipment-item" key={item.id} onClick={() => buyConsumable(item.id)} type="button">
                <span>
                  {item.name} <small>{item.description}</small>
                </span>
                <small>{item.price} gold</small>
              </button>
            ))}
          </div>
        )}
        <div className="equipment">
          <div className="equipment-head">
            <strong>{selectedHero.name}</strong>
            <span>
              Lv {selectedHero.level} / EXP {selectedHero.exp}/{selectedHero.nextExp}
            </span>
            <span>ATK {selectedStats.attack} / HP {selectedStats.maxHp} / MP {selectedStats.maxMp}</span>
            <span style={{ color: elementColors[selectedHero.element] }}>属性 {elementLabels[selectedHero.element]}</span>
            <div className="attribute-grid" aria-label="基礎ステータス">
              <span>STR {selectedHero.str}</span>
              <span>VIT {selectedHero.vit}</span>
              <span>AGI {selectedHero.agi}</span>
              <span>INT {selectedHero.int}</span>
              <span>MEN {selectedHero.men}</span>
              <span>DEX {selectedHero.dex}</span>
              <span>詠唱 {selectedStats.skillCastSpeed.toFixed(2)}</span>
            </div>
            <div className="derived-grid" aria-label="派生ステータス">
              <span>物攻 {selectedStats.attack}</span>
              <span>重量 {selectedStats.carryWeight}</span>
              <span>物防 {selectedStats.physicalDefense}</span>
              <span>攻速 {selectedStats.attackSpeed.toFixed(2)}</span>
              <span>回避 {Math.round(selectedStats.evasion * 100)}%</span>
              <span>魔攻 {selectedStats.magicAttack}</span>
              <span>魔防 {selectedStats.magicDefense}</span>
              <span>MP回復 {selectedStats.mpRegen.toFixed(1)}</span>
              <span>命中 {Math.round(selectedStats.accuracy * 100)}%</span>
            </div>
          </div>
          {(Object.keys(selectedHero.equipment) as EquipmentSlot[]).map((slot) => {
            const item = selectedHero.equipment[slot];
            return (
              <button className="equipment-item" key={slot} onClick={() => enhanceEquipment(slot)} type="button">
                <span>
                  {item.name} +{item.level}
                </span>
                <small>{upgradeCost(item)} gold</small>
              </button>
            );
          })}
        </div>
        <div className="equipment inventory">
          <div className="equipment-head">
            <strong>所持装備</strong>
            <span>クリックで選択中キャラに付け替え</span>
          </div>
          {hud.inventory.length === 0 ? (
            <p className="empty-inventory">所持装備なし</p>
          ) : (
            hud.inventory.map((item, index) => (
              <button className="equipment-item" key={`${item.id}-${index}`} onClick={() => equipInventoryItem(index)} type="button">
                <span>
                  {item.name} <small>{item.slot}</small>
                </span>
                <small>Equip</small>
              </button>
            ))
          )}
        </div>
        <div className="equipment inventory">
          <div className="equipment-head">
            <strong>所持道具</strong>
            <span>クリックで選択中キャラに使用</span>
          </div>
          {hud.consumables.length === 0 ? (
            <p className="empty-inventory">ポーションなし</p>
          ) : (
            hud.consumables.map((stack) => (
              <button className="equipment-item" key={stack.item.id} onClick={() => useConsumable(stack.item.id)} type="button">
                <span>
                  {stack.item.name} <small>HP +{stack.item.healHp}</small>
                </span>
                <small>x{stack.count}</small>
              </button>
            ))
          )}
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
