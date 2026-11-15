(async function () {
  const KEY = "bases-unificadas-v1",
    PAGE = 100;
  const $ = (id) => document.getElementById(id);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  function ejemplo() {
    const cl = {
      id: "t_cli",
      name: "Clientes",
      cols: [
        { id: "c_nom", name: "Nombre", type: "text" },
        { id: "c_ciu", name: "Ciudad", type: "text" },
      ],
      rows: [],
    };
    [
      ["Abarrotes La Ceiba", "Puebla"],
      ["Ferretería del Sur", "Guadalajara"],
      ["Papelería Central", "Querétaro"],
      ["Taller Hermanos Ruiz", "Toluca"],
    ].forEach((r, i) => cl.rows.push({ id: "rc" + i, c: { c_nom: r[0], c_ciu: r[1] } }));
    const ve = {
      id: "t_ven",
      name: "Ventas",
      cols: [
        { id: "v_fol", name: "Folio", type: "text" },
        { id: "v_fec", name: "Fecha", type: "date" },
        { id: "v_cli", name: "Cliente", type: "relation", table: "t_cli" },
        { id: "v_ciu", name: "Ciudad", type: "lookup", rel: "v_cli", target: "c_ciu" },
        { id: "v_can", name: "Cantidad", type: "number" },
        { id: "v_pre", name: "Precio", type: "number" },
        { id: "v_tot", name: "Total", type: "formula", expr: "{Cantidad} * {Precio}" },
      ],
      rows: [],
    };
    [
      ["V-001", "2026-11-02", 0, 12, 85],
      ["V-002", "2026-11-03", 1, 3, 1250],
      ["V-003", "2026-11-05", 0, -2, 85],
      ["V-004", "2026-11-09", 2, 40, 18.5],
      ["V-005", "2026-11-12", 3, 1, 3200],
      ["V-006", "2026-11-14", 1, -1, 1250],
    ].forEach((r, i) =>
      ve.rows.push({
        id: "rv" + i,
        c: { v_fol: r[0], v_fec: r[1], v_cli: "rc" + r[2], v_can: r[3], v_pre: r[4] },
      }),
    );
    return [ve, cl, productos()];
  }
  function productos() {
    const pr = {
      id: "t_pro",
      name: "Productos",
      cols: [
        { id: "p_nom", name: "Producto", type: "text" },
        { id: "p_cat", name: "Categoría", type: "text" },
        { id: "p_cos", name: "Costo", type: "number" },
      ],
      rows: [],
    };
    [
      ["Caja de tornillos", "Ferretería", 60],
      ["Taladro", "Herramienta", 980],
      ["Cuaderno", "Papelería", 11],
      ["Compresor", "Herramienta", 2600],
    ].forEach((r, i) => pr.rows.push({ id: "rp" + i, c: { p_nom: r[0], p_cat: r[1], p_cos: r[2] } }));
    return pr;
  }

  /* ---------- dónde se guarda ----------
     El estado se guarda en dos lugares del navegador:
     - IndexedDB: el principal. Tiene mucho más espacio, así que no se llena con los reportes guardados.
     - localStorage: una copia, mientras quepa. Es donde vivía todo antes, y se escribe al instante, lo
       que protege el último cambio si la página se cierra de golpe.
     Al abrir se lee de los dos y se usa el más reciente (state.mod). Así, quien llega con datos de antes
     los conserva sin hacer nada, y si uno de los dos falla el otro sigue sirviendo. */
  const BD = "bases-unificadas",
    ALMACEN = "datos";
  function abrirBD() {
    return new Promise((res) => {
      let listo = false;
      const fin = (x) => {
        if (listo) return;
        listo = true;
        res(x);
      };
      setTimeout(() => fin(null), 2500); /* hay navegadores que nunca contestan si lo tienen bloqueado */
      try {
        const rq = indexedDB.open(BD, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(ALMACEN);
        rq.onsuccess = () => fin(rq.result);
        rq.onerror = rq.onblocked = () => fin(null);
      } catch (e) {
        fin(null);
      }
    });
  }
  const bd = await abrirBD();
  function leerBD() {
    return new Promise((res) => {
      if (!bd) return res(null);
      try {
        const rq = bd.transaction(ALMACEN).objectStore(ALMACEN).get(KEY);
        rq.onsuccess = () => res(rq.result || null);
        rq.onerror = () => res(null);
      } catch (e) {
        res(null);
      }
    });
  }
  function escribirBD(txt) {
    return new Promise((res) => {
      if (!bd) return res(false);
      try {
        const tx = bd.transaction(ALMACEN, "readwrite");
        tx.objectStore(ALMACEN).put(txt, KEY);
        tx.oncomplete = () => res(true);
        tx.onerror = tx.onabort = () => res(false);
      } catch (e) {
        res(false);
      }
    });
  }
  const leeEstado = (txt) => {
    try {
      const o = JSON.parse(txt);
      return o && typeof o === "object" ? o : null;
    } catch (e) {
      return null;
    }
  };
  let deLS = null;
  try {
    deLS = leeEstado(localStorage.getItem(KEY));
  } catch (e) {}
  const deBD = leeEstado(await leerBD());
  let state = deBD && (!deLS || (deBD.mod || 0) >= (deLS.mod || 0)) ? deBD : deLS;
  /* Datos que solo estaban en localStorage: se copian al almacén principal desde el primer momento. */
  const migrar = !!bd && !!state && state === deLS;
  if (!state) state = {};
  if (!Array.isArray(state.books)) {
    const ej = Array.isArray(state.tables)
      ? { id: "b_ej", name: "Ejemplo", tables: state.tables, demo: !!state.demo }
      : { id: "b_ej", name: "Ejemplo", tables: ejemplo(), demo: true };
    if (ej.demo && !ej.tables.some((t) => t.id === "t_pro")) ej.tables.push(productos());
    state = { books: [ej], prefs: state.prefs, cur: "b_ej" };
  }
  if (!Array.isArray(state.tree))
    state.tree = [
      {
        id: "sec_per",
        kind: "room",
        name: "Personal",
        open: true,
        children: state.books.map((b) => ({ kind: "book", book: b.id })),
      },
      { id: "sec_com", kind: "room", name: "Compartido", open: true, children: [] },
    ];
  const MESES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const book = () => state.books.find((b) => b.id === state.cur) || state.books[0];
  Object.defineProperty(state, "tables", {
    get() {
      return book().tables;
    },
    set(v) {
      book().tables = v;
    },
    enumerable: false,
  });
  Object.defineProperty(state, "demo", {
    get() {
      return !!book().demo;
    },
    set(v) {
      book().demo = v;
    },
    enumerable: false,
  });
  state.prefs = Object.assign(
    { tema: "sistema", hc: false, numcolor: true, zt: 100, zn: 100, pHl: true, pBd: true },
    state.prefs || {},
  );
  const ui = {
    tab: state.tables[0] && state.tables[0].id,
    q: "",
    f: { col: "", op: "has", val: "" },
    sort: { col: "", dir: 1 },
    sort2: { col: "", dir: 1 },
    limit: PAGE,
    vista: "inicio",
  };

  const agg = new Map();
  let saveT,
    desde = 0,
    pendiente = false;
  /* Escribe de inmediato en los dos lugares. Solo avisa si no se pudo guardar en ninguno: que la copia
     de localStorage no quepa es normal cuando hay muchos datos. */
  function guardarYa() {
    clearTimeout(saveT);
    if (!pendiente) return;
    pendiente = false;
    state.mod = Date.now();
    const txt = JSON.stringify(state);
    let enLS = true;
    try {
      localStorage.setItem(KEY, txt);
    } catch (e) {
      enLS = false;
    }
    escribirBD(txt).then((enBD) => {
      $("avisoGuardado").hidden = enBD || enLS;
    });
  }
  /* Guarda 300 ms después del último cambio, pero nunca espera más de 2 segundos desde el primero:
     así una captura continua no pospone el guardado indefinidamente. */
  function save() {
    agg.clear();
    if (!pendiente) desde = Date.now();
    pendiente = true;
    clearTimeout(saveT);
    if (Date.now() - desde >= 2000) guardarYa();
    else saveT = setTimeout(guardarYa, 300);
  }
  /* Al cerrar, recargar o cambiar de aplicación se guarda sin esperar. */
  window.addEventListener("pagehide", guardarYa);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") guardarYa();
  });
  const idx = new Map();
  function dirty() {
    idx.clear();
    save();
  }
  function rowIndex(t) {
    let m = idx.get(t.id);
    if (!m) {
      m = new Map(t.rows.map((r) => [r.id, r]));
      idx.set(t.id, m);
    }
    return m;
  }
  const tableById = (id) => state.tables.find((t) => t.id === id);
  const colById = (t, id) => t.cols.find((c) => c.id === id);
  const colByName = (t, n) => {
    n = n.toLowerCase();
    return t.cols.find((c) => c.name.toLowerCase() === n);
  };
  const cur = () => tableById(ui.tab);

  /* ---------- deshacer / rehacer ---------- */
  const undoS = [],
    redoS = [],
    UNDO_CHARS = 12e6;
  const foto = () => JSON.stringify({ t: state.tables, d: state.demo, tab: ui.tab });
  function botones() {
    $("btnUndo").disabled = !undoS.length;
    $("btnRedo").disabled = !redoS.length;
  }
  function snap() {
    agg.clear();
    undoS.push(foto());
    if (undoS.length > 50) undoS.shift();
    /* Con tablas grandes cada copia pesa: se conservan las más recientes hasta un tope de tamaño. */
    for (let i = undoS.length - 1, n = 0; i >= 0; i--) {
      n += undoS[i].length;
      if (n > UNDO_CHARS && i < undoS.length - 1) {
        undoS.splice(0, i + 1);
        break;
      }
    }
    redoS.length = 0;
    botones();
  }
  function restaurar(s) {
    const o = JSON.parse(s);
    state.tables = o.t;
    state.demo = o.d;
    idx.clear();
    save();
    const tab = tableById(o.tab) ? o.tab : state.tables[0] && state.tables[0].id;
    if (tab !== ui.tab) goTab(tab);
    else render();
    botones();
  }
  function undoApp() {
    if (!undoS.length) return;
    redoS.push(foto());
    restaurar(undoS.pop());
  }
  function redoApp() {
    if (!redoS.length) return;
    undoS.push(foto());
    restaurar(redoS.pop());
  }

  /* ---------- fórmulas: analizador propio, sin eval ---------- */
  const fcache = new Map();
  function compile(expr) {
    if (fcache.has(expr)) return fcache.get(expr);
    let fn = null;
    try {
      const toks = [],
        re = /\s*(?:(\{[^}]*\})|(\d*\.?\d+)|([-+*\/()]))/y;
      let i = 0;
      while (i < expr.length) {
        if (!expr.slice(i).trim()) break;
        re.lastIndex = i;
        const m = re.exec(expr);
        if (!m) throw 0;
        toks.push(m[1] ? { r: m[1].slice(1, -1).trim() } : m[2] ? { n: +m[2] } : { o: m[3] });
        i = re.lastIndex;
      }
      if (!toks.length) throw 0;
      let p = 0;
      const peek = () => toks[p] && toks[p].o;
      const prim = () => {
        const t = toks[p++];
        if (!t) throw 0;
        if (t.n !== undefined) {
          const v = t.n;
          return () => v;
        }
        if (t.r !== undefined) {
          const n = t.r;
          return (g) => g(n);
        }
        if (t.o === "(") {
          const e = sum();
          if (!toks[p] || toks[p++].o !== ")") throw 0;
          return e;
        }
        if (t.o === "-") {
          const e = prim();
          return (g) => -e(g);
        }
        throw 0;
      };
      const prod = () => {
        let a = prim();
        while (peek() === "*" || peek() === "/") {
          const o = toks[p++].o,
            b = prim(),
            l = a;
          a = o === "*" ? (g) => l(g) * b(g) : (g) => l(g) / b(g);
        }
        return a;
      };
      const sum = () => {
        let a = prod();
        while (peek() === "+" || peek() === "-") {
          const o = toks[p++].o,
            b = prod(),
            l = a;
          a = o === "+" ? (g) => l(g) + b(g) : (g) => l(g) - b(g);
        }
        return a;
      };
      fn = sum();
      if (p < toks.length) fn = null;
    } catch (e) {
      fn = null;
    }
    fcache.set(expr, fn);
    return fn;
  }

  /* ---------- valores ---------- */
  function val(t, row, col, d) {
    d = d || 0;
    if (!row || !col) return "";
    if (d > 12) return "#CICLO";
    if (col.type === "lookup") {
      const rc = colById(t, col.rel);
      if (!rc) return "#REF";
      const tt = tableById(rc.table);
      if (!tt) return "#REF";
      const tr = rowIndex(tt).get(row.c[rc.id]);
      if (!tr) return "";
      const tc = colById(tt, col.target);
      if (!tc) return "#REF";
      return shown(tt, tr, tc, d + 1);
    }
    if (col.type === "formula") {
      const f = compile(col.expr || "");
      if (!f) return "#ERROR";
      let bad = null;
      const r = f((n) => {
        const c = colByName(t, n);
        if (!c) {
          bad = "#REF";
          return NaN;
        }
        const v = val(t, row, c, d + 1);
        if (typeof v === "string" && v[0] === "#") bad = v;
        return v === "" ? 0 : Number(v);
      });
      return bad || (Number.isFinite(r) ? r : "#ERROR");
    }
    if (col.type === "check") return row.c[col.id] ? "Sí" : "No";
    if (col.type === "multi") {
      const v = row.c[col.id];
      return Array.isArray(v) ? v.join(", ") : "";
    }
    if (col.type === "sum") {
      const m = sumMap(col);
      return m ? Math.round((m.get(row.id) || 0) * 100) / 100 : "#REF";
    }
    const v = row.c[col.id];
    return v === undefined || v === null ? "" : v;
  }
  function sumMap(col) {
    const k = col.table + "|" + col.rel + "|" + col.target;
    let m = agg.get(k);
    if (m) return m;
    const ct = tableById(col.table),
      rc = ct && colById(ct, col.rel),
      tc = ct && colById(ct, col.target);
    if (!rc || !tc) return null;
    m = new Map();
    agg.set(k, m);
    for (const x of ct.rows) {
      const p = x.c[rc.id];
      if (!p) continue;
      const v = val(ct, x, tc);
      if (typeof v === "number") m.set(p, (m.get(p) || 0) + v);
    }
    return m;
  }
  function shown(t, row, col, d) {
    d = d || 0;
    if (col.type === "relation") {
      if (d > 12) return "#CICLO";
      const tt = tableById(col.table),
        tr = tt && rowIndex(tt).get(row.c[col.id]);
      return tr && tt.cols[0] ? String(shown(tt, tr, tt.cols[0], d + 1)) : "";
    }
    return val(t, row, col, d);
  }
  const fmt = (v) => (typeof v === "number" ? v.toLocaleString("es-MX", { maximumFractionDigits: 2 }) : v);
  const numCls = (v) => (typeof v === "number" ? (v > 0 ? "pos" : v < 0 ? "neg" : "") : "");

  function view(t) {
    let rows = t.rows;
    const q = ui.q.trim().toLowerCase();
    if (q)
      rows = rows.filter((r) =>
        t.cols.some((c) =>
          String(shown(t, r, c))
            .toLowerCase()
            .includes(q),
        ),
      );
    const f = ui.f,
      fc = f.col && colById(t, f.col);
    if (fc && f.val !== "") {
      const fv = f.val.toLowerCase(),
        fn = Number(f.val);
      rows = rows.filter((r) => {
        const v = shown(t, r, fc),
          num = typeof v === "number";
        if (f.op === "has") return String(v).toLowerCase().includes(fv);
        if (f.op === "eq") return num ? v === fn : String(v).toLowerCase() === fv;
        if (v === "") return false;
        if (f.op === "gt") return num ? v > fn : String(v) > f.val;
        return num ? v < fn : String(v) < f.val;
      });
    }
    const ss = [ui.sort, ui.sort2]
      .map((x) => ({ c: x.col && colById(t, x.col), dir: x.dir }))
      .filter((x) => x.c);
    if (ss.length) {
      ss.forEach((x) => {
        x.k = new Map(rows.map((r) => [r, shown(t, r, x.c)]));
      });
      const cmp = (x, y, dir) => {
        if (x === "" && y !== "") return 1;
        if (y === "" && x !== "") return -1;
        return (
          (typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), "es", { numeric: true })) * dir
        );
      };
      rows = rows.slice().sort((p, q) => {
        for (const x of ss) {
          const r = cmp(x.k.get(p), x.k.get(q), x.dir);
          if (r) return r;
        }
        return 0;
      });
    }
    return rows;
  }

  /* ---------- pintar ---------- */
  function tipoTxt(t, c) {
    if (c.type === "relation") {
      const tt = tableById(c.table);
      return "→ " + (tt ? tt.name : "?");
    }
    if (c.type === "lookup") {
      const rc = colById(t, c.rel);
      return "de " + (rc ? rc.name : "?");
    }
    if (c.type === "formula") return "= " + c.expr;
    if (c.type === "sum") {
      const tt = tableById(c.table);
      return "Σ " + (tt ? tt.name : "?");
    }
    return {
      text: "texto",
      number: "número",
      date: "fecha",
      select: "selección",
      multi: "selección múltiple",
      check: "casilla",
    }[c.type];
  }
  let sel = null;
  function fcls(t, r, c) {
    let s = sel && sel.row === r.id && sel.col === c.id ? " sel" : "";
    const f = t.fmt;
    if (!f) return s;
    const a = f.cells[r.id + "|" + c.id] || {},
      b = f.rows[r.id] || {},
      d = f.cols[c.id] || {};
    if (a.b || b.b || d.b) s += " bd";
    if (a.h || b.h || d.h) s += " hl";
    return s;
  }
  const optVals = (r, c) => {
    const v = r.c[c.id];
    return c.type === "multi" ? (Array.isArray(v) ? v : []) : v ? [String(v)] : [];
  };
  function cellHTML(t, r, c) {
    const k = fcls(t, r, c);
    if (c.type === "check")
      return (
        '<td class="' +
        k +
        '" data-c="' +
        c.id +
        '"><label class="ck"><input type="checkbox" id="x_' +
        r.id +
        "_" +
        c.id +
        '" data-check="' +
        c.id +
        '"' +
        (r.c[c.id] ? " checked" : "") +
        ' aria-label="' +
        esc(c.name) +
        '"></label></td>'
      );
    if (c.type === "select" || c.type === "multi") {
      const a = optVals(r, c);
      return (
        '<td class="' +
        k +
        '" data-c="' +
        c.id +
        '"><button type="button" class="rel opt" data-opt="' +
        c.id +
        '" aria-label="' +
        esc(c.name) +
        ": " +
        esc(a.join(", ") || "sin elegir") +
        '">' +
        (a.length
          ? a.map((x) => '<span class="pill">' + esc(x) + "</span>").join("")
          : '<span class="vac">Elegir</span>') +
        "</button></td>"
      );
    }
    if (c.type === "relation") {
      const s = shown(t, r, c);
      return (
        '<td class="' +
        k +
        '" data-c="' +
        c.id +
        '"><button type="button" class="rel" data-pick="' +
        c.id +
        '" aria-label="' +
        esc(c.name) +
        ": " +
        esc(s || "sin elegir") +
        '">' +
        (s !== "" ? esc(s) : '<span class="vac">Elegir</span>') +
        "</button></td>"
      );
    }
    if (c.type === "lookup" || c.type === "formula" || c.type === "sum") {
      const v = val(t, r, c);
      return (
        '<td class="calc ' +
        (typeof v === "number" ? "n " : "") +
        numCls(v) +
        k +
        '" data-c="' +
        c.id +
        '" data-calc="' +
        c.id +
        '">' +
        esc(fmt(v)) +
        "</td>"
      );
    }
    const v = r.c[c.id] == null ? "" : r.c[c.id],
      n = c.type === "number";
    return (
      '<td class="' +
      k +
      '" data-c="' +
      c.id +
      '"><input id="x_' +
      r.id +
      "_" +
      c.id +
      '" ' +
      (n
        ? 'class="num ' + numCls(v) + '" type="number" step="any"'
        : 'type="' + (c.type === "date" ? "date" : "text") + '"') +
      ' value="' +
      esc(v) +
      '" data-cell="' +
      c.id +
      '" aria-label="' +
      esc(c.name) +
      '"></td>'
    );
  }
  const rowHTML = (t, r) =>
    '<tr data-id="' +
    r.id +
    '">' +
    t.cols.map((c) => cellHTML(t, r, c)).join("") +
    '<td><button type="button" class="del" data-del aria-label="Eliminar fila">×</button></td></tr>';

  function render() {
    const t = cur();
    $("demo").hidden = !state.demo;
    titulo();
    renderNav();
    if (ui.vista === "inicio") renderInicio();
    $("btnGen").hidden = !piezasGen();
    $("btnNota").hidden = !piezasNota();
    $("tabs").innerHTML =
      state.tables
        .map(
          (x) =>
            '<button type="button" class="tab" role="tab" aria-selected="' +
            (x.id === ui.tab) +
            '" data-tab="' +
            x.id +
            '">' +
            esc(x.name) +
            "</button>",
        )
        .join("") + '<button type="button" class="tab" data-new aria-label="Nueva tabla">+</button>';
    $("btnRep").disabled = !t;
    $("vacio").hidden = !!t;
    $("area").hidden = !t;
    if (!t) return;
    pintarVistas(t);
    const keep = ui.f.col;
    $("fCol").innerHTML =
      '<option value="">Columna…</option>' +
      t.cols.map((c) => '<option value="' + c.id + '">' + esc(c.name) + "</option>").join("");
    $("fCol").value = colById(t, keep) ? keep : "";
    {
      const fc0 = colById(t, $("fCol").value);
      $("fOpts").innerHTML =
        fc0 && fc0.options
          ? fc0.options.map((o) => '<option value="' + esc(o) + '"></option>').join("")
          : fc0 && fc0.type === "check"
            ? '<option value="Sí"></option><option value="No"></option>'
            : "";
    }
    const rows = view(t),
      page = rows.slice(0, ui.limit);
    let h =
      "<thead><tr>" +
      t.cols
        .map((c) => {
          const s = ui.sort.col === c.id,
            s2 = !s && ui.sort2.col === c.id,
            sd = s ? ui.sort.dir : ui.sort2.dir;
          return (
            '<th scope="col" data-h="' +
            c.id +
            '" aria-sort="' +
            (s ? (ui.sort.dir > 0 ? "ascending" : "descending") : "none") +
            '"><div class="thbox"><button type="button" class="th" data-sort="' +
            c.id +
            '">' +
            esc(c.name) +
            '<span class="ar" aria-hidden="true">' +
            (s || s2 ? (sd > 0 ? "↑" : "↓") + (s2 ? "2" : ui.sort2.col ? "1" : "") : "") +
            '</span></button><button type="button" class="cfg" data-col="' +
            c.id +
            '" aria-haspopup="dialog" aria-label="Opciones de la columna ' +
            esc(c.name) +
            ': formato, total y edición">⋯</button></div><span class="tipo">' +
            esc(tipoTxt(t, c)) +
            "</span></th>"
          );
        })
        .join("") +
      '<th><span class="sr">Acciones</span></th></tr></thead><tbody>';
    h += page.map((r) => rowHTML(t, r)).join("");
    if (!page.length)
      h +=
        '<tr><td class="calc" colspan="' +
        (t.cols.length + 1) +
        '" style="color:var(--muted)">' +
        (t.rows.length ? "Ninguna fila coincide." : "Sin filas. Toca “+ Fila”.") +
        "</td></tr>";
    $("grid").innerHTML = h + "</tbody><tfoot>" + pieFila(t, rows) + "</tfoot>";
    if (colMenu) marcaCol();
    $("conteo").textContent =
      (rows.length === t.rows.length ? t.rows.length : rows.length + " de " + t.rows.length) +
      (t.rows.length === 1 ? " fila" : " filas");
    $("mas").hidden = rows.length <= ui.limit;
  }
  function goTab(id) {
    sel = null;
    ui.tab = id;
    ui.q = "";
    ui.f = { col: "", op: "has", val: "" };
    {
      const tv = tableById(id),
        v = tv && tv.view;
      ui.sort = v && v.s ? { col: v.s.col, dir: v.s.dir } : { col: "", dir: 1 };
      ui.sort2 = v && v.s2 ? { col: v.s2.col, dir: v.s2.dir } : { col: "", dir: 1 };
    }
    ui.limit = PAGE;
    $("buscar").value = "";
    $("fVal").value = "";
    $("fOp").value = "has";
    render();
  }

  /* ---------- totales al pie ----------
     Cada columna puede mostrar un total (c.pie: "sum", "avg" o "count") al pie de la tabla. Se calcula
     con todas las filas que pasan la búsqueda y el filtro, no solo con las que están pintadas. */
  const SUMABLE = ["number", "formula", "sum", "lookup"];
  function totalDe(t, rows, c) {
    let conDato = 0,
      nums = 0,
      suma = 0;
    rows.forEach((r) => {
      if (c.type === "check") {
        if (r.c[c.id]) conDato++;
        return;
      }
      const v = shown(t, r, c);
      if (v !== "" && v != null) conDato++;
      if (typeof v === "number") {
        nums++;
        suma += v;
      }
    });
    if (c.pie === "count") return { l: c.type === "check" ? "Marcadas" : "Conteo", v: conDato };
    const r2 = (x) => Math.round(x * 100) / 100;
    if (c.pie === "sum") return { l: "Suma", v: r2(suma) };
    return { l: "Promedio", v: nums ? r2(suma / nums) : "" };
  }
  /* La fila del pie, o nada si ninguna columna tiene total. En impresión no lleva la columna de acciones. */
  function pieFila(t, rows, impresion) {
    if (!t.cols.some((c) => c.pie)) return "";
    return (
      "<tr>" +
      t.cols
        .map((c) => {
          if (!c.pie) return '<td class="pie-c"></td>';
          const o = totalDe(t, rows, c);
          return (
            '<td class="pie-c n ' +
            (c.pie === "count" ? "" : numCls(o.v)) +
            '"><span class="pie-l">' +
            o.l +
            "</span>" +
            esc(o.v === "" ? "sin datos" : fmt(o.v)) +
            "</td>"
          );
        })
        .join("") +
      (impresion ? "" : '<td class="pie-c"></td>') +
      "</tr>"
    );
  }
  function pintarPie(t) {
    const tf = $("grid").querySelector("tfoot");
    if (tf && t.cols.some((c) => c.pie)) tf.innerHTML = pieFila(t, view(t));
  }

  /* ---------- menú de columna ----------
     El botón ⋯ de cada encabezado selecciona toda la columna y abre su menú: formato, total al pie y
     edición. El tamaño de letra no está aquí a propósito: solo se cambia para la tabla completa. */
  let colMenu = null;
  function marcaCol() {
    $("grid")
      .querySelectorAll('[data-h="' + colMenu + '"], td[data-c="' + colMenu + '"]')
      .forEach((x) => x.classList.add("colsel"));
  }
  function pintarColMenu() {
    const t = cur(),
      c = colById(t, colMenu),
      f = (t.fmt && t.fmt.cols[c.id]) || {},
      pon = (id, txt, on) => {
        $(id).setAttribute("aria-pressed", String(!!on));
        $(id).textContent = (on ? "✓ " : "") + txt;
      };
    $("cmT").textContent = "Columna " + c.name;
    pon("cmB", "Negritas", f.b);
    pon("cmH", "Resaltar", f.h);
    const hayFmt = !!(
      t.fmt &&
      (t.fmt.cols[c.id] || Object.keys(t.fmt.cells).some((k) => k.endsWith("|" + c.id)))
    );
    $("cmClear").disabled = !hayFmt;
    const sumable = SUMABLE.includes(c.type);
    document.querySelectorAll("input[name=cmPie]").forEach((r) => {
      r.checked = r.value === (c.pie || "");
      r.parentElement.hidden = !sumable && (r.value === "sum" || r.value === "avg");
    });
    $("cmPieAyuda").textContent = sumable
      ? "El total usa las filas que están en pantalla: respeta la búsqueda, el filtro y la vista."
      : c.type === "check"
        ? "Esta columna es una casilla: el conteo dice cuántas están marcadas."
        : "Esta columna no es numérica: solo se puede contar cuántas filas tienen dato.";
  }
  function abrirColMenu(id) {
    colMenu = id;
    marcaCol();
    pintarColMenu();
    $("dlgColMenu").showModal();
  }
  $("dlgColMenu").addEventListener("close", () => {
    colMenu = null;
    $("grid")
      .querySelectorAll(".colsel")
      .forEach((x) => x.classList.remove("colsel"));
  });
  $("dlgColMenu").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-cm]"),
      t = cur();
    if (!b || !colMenu) return;
    const k = b.dataset.cm;
    snap();
    if (k === "clear") {
      delete t.fmt.cols[colMenu];
      Object.keys(t.fmt.cells).forEach((x) => {
        if (x.endsWith("|" + colMenu)) delete t.fmt.cells[x];
      });
    } else {
      const f = t.fmt || (t.fmt = { cells: {}, rows: {}, cols: {} }),
        o = f.cols[colMenu] || (f.cols[colMenu] = {});
      o[k] = !o[k];
      if (!o.b && !o.h) delete f.cols[colMenu];
    }
    save();
    render();
    pintarColMenu();
  });
  $("dlgColMenu").addEventListener("change", (e) => {
    if (e.target.name !== "cmPie" || !colMenu) return;
    const c = colById(cur(), colMenu);
    snap();
    if (e.target.value) c.pie = e.target.value;
    else delete c.pie;
    save();
    render();
  });
  $("cmEditar").onclick = () => {
    const id = colMenu;
    $("dlgColMenu").close();
    openCol(id);
  };

  /* ---------- vistas guardadas ----------
     Una vista es una búsqueda, un filtro y un orden con nombre, guardados en su tabla (t.vistas).
     No hay "vista activa" que recordar: el botón de una vista se marca cuando lo que está en pantalla
     coincide con lo que guardó. */
  const SIN_F = () => ({ col: "", op: "has", val: "" });
  const hayFiltro = () => !!(ui.f.col && ui.f.val !== "");
  function vistaAhora() {
    const o = (x) => (x.col ? { col: x.col, dir: x.dir } : { col: "", dir: 1 });
    return {
      q: ui.q.trim(),
      f: hayFiltro() ? { col: ui.f.col, op: ui.f.op, val: ui.f.val } : SIN_F(),
      s: o(ui.sort),
      s2: o(ui.sort2),
    };
  }
  const igual = (a, b) =>
    a.col === b.col && (!a.col || (a.dir === b.dir && a.op === b.op && a.val === b.val));
  /* Una vista sin orden propio coincide con cualquier orden. */
  function coincide(v, a) {
    return v.q === a.q && igual(v.f, a.f) && (!v.s.col || (igual(v.s, a.s) && igual(v.s2, a.s2)));
  }
  function pintarVistas(t) {
    const a = vistaAhora(),
      vs = t.vistas || [],
      act = vs.find((v) => coincide(v, a)),
      marca = (on) => 'aria-pressed="' + on + '">' + (on ? '<span aria-hidden="true">✓ </span>' : "");
    $("vistas").innerHTML =
      '<button type="button" class="btn sm" data-todas ' +
      marca(!act && !a.q && !a.f.col) +
      "Todas las filas</button>" +
      vs
        .map(
          (v) =>
            '<button type="button" class="btn sm" data-vista="' +
            v.id +
            '" ' +
            marca(v === act) +
            esc(v.name) +
            "</button>",
        )
        .join("") +
      (act
        ? '<button type="button" class="btn sm" data-editar="' +
          act.id +
          '" aria-label="Editar la vista ' +
          esc(act.name) +
          '">Editar vista</button>'
        : '<button type="button" class="btn sm" data-guardar>Guardar vista</button>');
  }
  function aplicarVista(v) {
    const t = cur();
    ui.q = v.q;
    ui.f = { col: colById(t, v.f.col) ? v.f.col : "", op: v.f.op, val: v.f.val };
    if (v.s.col) {
      ui.sort = { col: v.s.col, dir: v.s.dir };
      ui.sort2 = { col: v.s2.col, dir: v.s2.dir };
    }
    ui.limit = PAGE;
    $("buscar").value = ui.q;
    $("fVal").value = ui.f.val;
    $("fOp").value = ui.f.op;
    if (hayFiltro()) {
      $("filtro").hidden = false;
      $("btnFiltro").setAttribute("aria-expanded", "true");
    }
    render();
  }
  let vistaEdit = null;
  function abrirVista(v) {
    const t = cur(),
      a = vistaAhora(),
      d = descVista(t),
      vacia = !v && !a.q && !a.f.col && !a.s.col;
    vistaEdit = v || null;
    $("visT").textContent = v ? "Editar vista" : "Guardar vista";
    $("visNombre").value = v ? v.name : "";
    $("visInfo").textContent =
      (ui.q.trim() || hayFiltro() ? d.filtro : "Sin búsqueda ni filtro") +
      " · Orden: " +
      d.orden.toLowerCase() +
      ".";
    $("visError").textContent = vacia
      ? "Primero busca, filtra u ordena la tabla. Después vuelve aquí para guardar esa vista."
      : "";
    $("visOk").disabled = vacia;
    $("visBorrar").hidden = !v;
    $("dlgVista").showModal();
  }
  $("vistas").addEventListener("click", (e) => {
    const b = e.target.closest("button"),
      t = cur();
    if (!b || !t) return;
    const busca = (id) => (t.vistas || []).find((v) => v.id === id);
    if ("todas" in b.dataset) {
      $("filtro").hidden = true;
      $("btnFiltro").setAttribute("aria-expanded", "false");
      goTab(t.id);
      $("vistas").querySelector("[data-todas]").focus();
    } else if (b.dataset.vista) {
      const v = busca(b.dataset.vista);
      if (!v) return;
      aplicarVista(v);
      const again = $("vistas").querySelector('[data-vista="' + v.id + '"]');
      if (again) again.focus();
    } else if (b.dataset.editar) abrirVista(busca(b.dataset.editar));
    else abrirVista();
  });
  $("formVista").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = cur(),
      n = $("visNombre").value.trim();
    if (!n) {
      $("visError").textContent = "Escribe un nombre para la vista.";
      return;
    }
    if ((t.vistas || []).some((v) => v !== vistaEdit && v.name.toLowerCase() === n.toLowerCase())) {
      $("visError").textContent = "Ya hay una vista con ese nombre en esta tabla.";
      return;
    }
    snap();
    if (vistaEdit) vistaEdit.name = n;
    else (t.vistas = t.vistas || []).push(Object.assign({ id: "v_" + uid(), name: n }, vistaAhora()));
    $("dlgVista").close();
    save();
    render();
  });
  $("visBorrar").onclick = () => {
    const t = cur();
    snap();
    t.vistas = t.vistas.filter((v) => v !== vistaEdit);
    if (!t.vistas.length) delete t.vistas;
    $("dlgVista").close();
    save();
    render();
    toast("Vista eliminada", undoApp);
  };

  /* ---------- rejilla ---------- */
  $("grid").addEventListener("change", (e) => {
    const ck = e.target.closest("[data-check]");
    if (ck) {
      const t0 = cur(),
        r0 = rowIndex(t0).get(ck.closest("tr").dataset.id);
      if (!r0) return;
      snap();
      r0.c[ck.dataset.check] = ck.checked;
      save();
      pintarPie(t0);
      return;
    }
    const inp = e.target.closest("[data-cell]");
    if (!inp) return;
    const t = cur(),
      tr = inp.closest("tr"),
      r = rowIndex(t).get(tr.dataset.id),
      c = colById(t, inp.dataset.cell);
    if (!r || !c) return;
    snap();
    if (c.type === "number") {
      const v = inp.value === "" ? "" : Number(inp.value);
      r.c[c.id] = Number.isFinite(v) || v === "" ? v : "";
      inp.className = "num " + numCls(r.c[c.id]);
    } else r.c[c.id] = inp.value;
    tr.querySelectorAll("[data-calc]").forEach((td) => {
      const cc = colById(t, td.dataset.calc),
        v = val(t, r, cc);
      td.textContent = fmt(v);
      td.className = "calc " + (typeof v === "number" ? "n " : "") + numCls(v) + fcls(t, r, cc);
    });
    save();
    pintarPie(t);
  });
  $("grid").addEventListener("click", (e) => {
    const t = cur(),
      b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.sort) {
      const id = b.dataset.sort,
        s = ui.sort,
        nada = { col: "", dir: 1 };
      if (s.col !== id) {
        ui.sort2 = s.col ? { col: s.col, dir: s.dir } : nada;
        ui.sort = { col: id, dir: 1 };
      } else if (s.dir === 1) s.dir = -1;
      else {
        ui.sort = ui.sort2.col ? ui.sort2 : nada;
        ui.sort2 = { col: "", dir: 1 };
      }
      t.view = { s: { col: ui.sort.col, dir: ui.sort.dir }, s2: { col: ui.sort2.col, dir: ui.sort2.dir } };
      save();
      render();
    } else if (b.dataset.col) abrirColMenu(b.dataset.col);
    else if (b.dataset.pick) openPick(b.closest("tr").dataset.id, b.dataset.pick);
    else if (b.dataset.opt) openOpt(b.closest("tr").dataset.id, b.dataset.opt);
    else if ("del" in b.dataset) {
      const id = b.closest("tr").dataset.id,
        i = t.rows.findIndex((r) => r.id === id);
      snap();
      t.rows.splice(i, 1);
      dirty();
      render();
      toast("Fila eliminada", undoApp);
    }
  });
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tab) goTab(b.dataset.tab);
    else nuevaTabla();
  });
  function nuevaTabla() {
    let n = 1;
    while (state.tables.some((t) => t.name === "Tabla " + n)) n++;
    const t = {
      id: "t_" + uid(),
      name: "Tabla " + n,
      cols: [{ id: "c_" + uid(), name: "Nombre", type: "text" }],
      rows: [],
    };
    snap();
    state.tables.push(t);
    dirty();
    goTab(t.id);
  }
  $("btnNuevaVacio").onclick = nuevaTabla;

  let qT;
  $("buscar").addEventListener("input", (e) => {
    ui.q = e.target.value;
    ui.limit = PAGE;
    clearTimeout(qT);
    qT = setTimeout(render, 150);
  });
  $("btnFiltro").onclick = () => {
    const f = $("filtro");
    f.hidden = !f.hidden;
    $("btnFiltro").setAttribute("aria-expanded", String(!f.hidden));
  };
  $("fCol").onchange = (e) => {
    ui.f.col = e.target.value;
    render();
  };
  $("fOp").onchange = (e) => {
    ui.f.op = e.target.value;
    render();
  };
  $("fVal").addEventListener("input", (e) => {
    ui.f.val = e.target.value;
    clearTimeout(qT);
    qT = setTimeout(render, 150);
  });
  $("fClear").onclick = () => {
    ui.f = { col: "", op: "has", val: "" };
    $("fVal").value = "";
    $("fOp").value = "has";
    render();
  };
  $("mas").onclick = () => {
    ui.limit += PAGE;
    render();
  };
  $("btnFila").onclick = () => {
    const t = cur(),
      r = { id: "r_" + uid(), c: {} };
    snap();
    t.rows.unshift(r);
    ui.q = "";
    ui.f.val = "";
    ui.sort.col = "";
    ui.sort2.col = "";
    $("buscar").value = "";
    $("fVal").value = "";
    dirty();
    render();
    const first = $("grid").querySelector("tbody tr input, tbody tr .rel");
    if (first) first.focus();
  };

  /* ---------- diálogos ---------- */
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-close]");
    if (b) b.closest("dialog").close();
  });
  function arm(btn, label, fn) {
    if (btn.dataset.armed) {
      delete btn.dataset.armed;
      btn.textContent = label;
      fn();
    } else {
      btn.dataset.armed = "1";
      btn.textContent = "Toca otra vez para eliminar";
    }
  }
  function disarm(btn, label) {
    delete btn.dataset.armed;
    btn.textContent = label;
  }

  let colEdit = null;
  const opts = (arr, f) =>
    arr.map((x) => '<option value="' + x.id + '">' + esc(f ? f(x) : x.name) + "</option>").join("");
  function fillTargets() {
    const t = cur(),
      rc = colById(t, $("colRel").value),
      tt = rc && tableById(rc.table);
    $("colTarget").innerHTML = tt ? opts(tt.cols) : "";
  }
  function fillSum() {
    const tt = tableById(($("colSumRel").value || "").split("|")[0]);
    $("colSumTarget").innerHTML = tt
      ? opts(tt.cols.filter((c) => ["number", "formula", "sum", "lookup"].includes(c.type)))
      : "";
  }
  function syncCol() {
    const ty = $("colTipo").value;
    $("fRel").hidden = ty !== "relation";
    $("fLook").hidden = ty !== "lookup";
    $("fForm").hidden = ty !== "formula";
    $("fSum").hidden = ty !== "sum";
    $("fOptsCol").hidden = ty !== "select" && ty !== "multi";
  }
  function openCol(id) {
    const t = cur();
    colEdit = id ? colById(t, id) : null;
    $("colTitulo").textContent = colEdit ? "Editar columna" : "Nueva columna";
    $("colNombre").value = colEdit ? colEdit.name : "";
    $("colTipo").value = colEdit ? colEdit.type : "text";
    $("colTipo").disabled = !!colEdit;
    $("colTabla").innerHTML = opts(state.tables);
    const other = state.tables.find((x) => x.id !== t.id);
    $("colTabla").value = colEdit && colEdit.type === "relation" ? colEdit.table : (other || t).id;
    $("colRel").innerHTML = opts(
      t.cols.filter((c) => c.type === "relation"),
      (c) => {
        const tt = tableById(c.table);
        return c.name + " → " + (tt ? tt.name : "?");
      },
    );
    if (colEdit && colEdit.type === "lookup") $("colRel").value = colEdit.rel;
    fillTargets();
    if (colEdit && colEdit.type === "lookup") $("colTarget").value = colEdit.target;
    $("colExpr").value = (colEdit && colEdit.expr) || "";
    $("colOpts").value = ((colEdit && colEdit.options) || []).join("\n");
    let so = "";
    state.tables.forEach((x) =>
      x.cols.forEach((c) => {
        if (c.type === "relation" && c.table === t.id)
          so += '<option value="' + x.id + "|" + c.id + '">' + esc(x.name + " · " + c.name) + "</option>";
      }),
    );
    $("colSumRel").innerHTML = so;
    if (colEdit && colEdit.type === "sum") $("colSumRel").value = colEdit.table + "|" + colEdit.rel;
    fillSum();
    if (colEdit && colEdit.type === "sum") $("colSumTarget").value = colEdit.target;
    $("colChips").innerHTML =
      t.cols
        .filter((c) => c !== colEdit && ["number", "formula", "lookup", "sum"].includes(c.type))
        .map(
          (c) =>
            '<button type="button" class="chip" data-chip="' + esc(c.name) + '">' + esc(c.name) + "</button>",
        )
        .join("") || '<span class="ayuda">Aún no hay columnas numéricas.</span>';
    $("colBorrar").hidden = !colEdit || t.cols.length < 2;
    disarm($("colBorrar"), "Eliminar");
    $("colError").textContent = "";
    syncCol();
    $("dlgCol").showModal();
  }
  $("btnCol").onclick = () => openCol();
  $("colTipo").onchange = syncCol;
  $("colSumRel").onchange = fillSum;
  $("colRel").onchange = fillTargets;
  $("colChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-chip]");
    if (!b) return;
    const i = $("colExpr");
    i.value += (i.value && !/\s$/.test(i.value) ? " " : "") + "{" + b.dataset.chip + "}";
    i.focus();
  });
  $("formCol").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = cur(),
      name = $("colNombre").value.trim(),
      ty = $("colTipo").value,
      err = (m) => {
        $("colError").textContent = m;
      };
    if (!name) return err("Escribe un nombre.");
    if (/[{}]/.test(name)) return err("El nombre no puede llevar llaves.");
    if (t.cols.some((c) => c !== colEdit && c.name.toLowerCase() === name.toLowerCase()))
      return err("Ya existe una columna con ese nombre.");
    const tb = $("colTabla").value,
      ex = $("colExpr").value.trim();
    if (ty === "relation" && !tb) return err("Elige una tabla.");
    if (ty === "lookup" && (!$("colRel").value || !$("colTarget").value))
      return err("Primero crea una columna de tipo Relación en esta tabla.");
    if (ty === "formula" && !compile(ex))
      return err("No se entiende la fórmula. Ejemplo: {Cantidad} * {Precio}");
    if (ty === "sum" && (!$("colSumRel").value || !$("colSumTarget").value))
      return err("Ninguna tabla se relaciona con esta todavía, o no tiene columnas numéricas.");
    snap();
    const c = colEdit || { id: "c_" + uid(), type: ty };
    if (ty === "relation") {
      if (colEdit && colEdit.table !== tb)
        t.rows.forEach((r) => {
          delete r.c[c.id];
        });
      c.table = tb;
    }
    if (ty === "lookup") {
      c.rel = $("colRel").value;
      c.target = $("colTarget").value;
    }
    if (ty === "formula") c.expr = ex;
    if (ty === "select" || ty === "multi")
      c.options = [
        ...new Set(
          $("colOpts")
            .value.split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ];
    if (ty === "sum") {
      const x = $("colSumRel").value.split("|");
      c.table = x[0];
      c.rel = x[1];
      c.target = $("colSumTarget").value;
    }
    if (colEdit && colEdit.name !== name) {
      /* La referencia puede venir con otras mayúsculas o con espacios: { cantidad } */
      const ref = new RegExp(
        "\\{\\s*" + colEdit.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\}",
        "gi",
      );
      t.cols.forEach((o) => {
        if (o.type === "formula") o.expr = o.expr.replace(ref, () => "{" + name + "}");
      });
    }
    c.name = name;
    if (!colEdit) t.cols.push(c);
    $("dlgCol").close();
    dirty();
    render();
  });
  $("colBorrar").onclick = () =>
    arm($("colBorrar"), "Eliminar", () => {
      const t = cur(),
        id = colEdit.id;
      snap();
      t.cols = t.cols.filter((c) => c.id !== id);
      t.rows.forEach((r) => {
        delete r.c[id];
      });
      if (ui.sort.col === id) ui.sort = { col: ui.sort2.col, dir: ui.sort2.dir };
      if (ui.sort.col === id || ui.sort2.col === id) ui.sort2 = { col: "", dir: 1 };
      if (ui.sort.col === id) ui.sort = { col: "", dir: 1 };
      if (ui.f.col === id) ui.f = SIN_F();
      /* Las vistas guardadas sueltan la columna eliminada. */
      (t.vistas || []).forEach((v) => {
        if (v.f.col === id) v.f = SIN_F();
        if (v.s.col === id) v.s = v.s2;
        if (v.s.col === id || v.s2.col === id) v.s2 = { col: "", dir: 1 };
        if (v.s.col === id) v.s = { col: "", dir: 1 };
      });
      $("dlgCol").close();
      dirty();
      render();
    });

  let pick = null;
  function openPick(rowId, colId) {
    const t = cur(),
      c = colById(t, colId),
      tt = tableById(c.table);
    if (!tt) return;
    pick = { rowId, c, tt };
    $("pickTitulo").textContent = "Elegir de " + tt.name;
    $("pickBuscar").value = "";
    drawPick();
    $("dlgPick").showModal();
  }
  function drawPick() {
    const t = cur(),
      r = rowIndex(t).get(pick.rowId),
      q = $("pickBuscar").value.trim().toLowerCase(),
      tt = pick.tt,
      tc = tt.cols[0];
    let n = 0,
      h = "";
    const t2 = tt.cols[1];
    for (const x of tt.rows) {
      const name = tc ? String(shown(tt, x, tc)) : "",
        sub = t2 ? String(shown(tt, x, t2)) : "";
      if (q && !(name + " " + sub).toLowerCase().includes(q)) continue;
      if (n < 50)
        h +=
          '<button type="button" data-id="' +
          x.id +
          '" aria-current="' +
          (r.c[pick.c.id] === x.id) +
          '">' +
          (esc(name) || '<span class="vac">(sin nombre)</span>') +
          (sub ? ' <span class="vac">· ' + esc(sub) + "</span>" : "") +
          "</button>";
      n++;
    }
    $("pickLista").innerHTML = h || '<button type="button" disabled>Sin resultados</button>';
    $("pickMas").textContent = n > 50 ? "Mostrando 50 de " + n + ". Escribe para acotar." : "";
  }
  $("pickBuscar").addEventListener("input", drawPick);
  function setPick(v) {
    const t = cur(),
      r = rowIndex(t).get(pick.rowId);
    snap();
    if (v) r.c[pick.c.id] = v;
    else delete r.c[pick.c.id];
    $("dlgPick").close();
    save();
    render();
  }
  $("pickLista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (b) setPick(b.dataset.id);
  });
  $("pickQuitar").onclick = () => setPick("");

  /* ---------- CSV ---------- */
  function parseCSV(s) {
    s = s.replace(/^﻿/, "");
    const first = s.split(/\r?\n/, 1)[0];
    const cnt = (ch) => first.split(ch).length,
      d = cnt(";") > cnt(",") && cnt(";") >= cnt("\t") ? ";" : cnt("\t") > cnt(",") ? "\t" : ",";
    const out = [];
    let row = [],
      c = "",
      q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"') {
          if (s[i + 1] === '"') {
            c += '"';
            i++;
          } else q = false;
        } else c += ch;
      } else if (ch === '"') q = true;
      else if (ch === d) {
        row.push(c);
        c = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && s[i + 1] === "\n") i++;
        row.push(c);
        c = "";
        out.push(row);
        row = [];
      } else c += ch;
    }
    if (c !== "" || row.length) {
      row.push(c);
      out.push(row);
    }
    return out.filter((r) => r.some((x) => x.trim() !== ""));
  }
  const csvCell = (v) => {
    v = String(v == null ? "" : v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  $("btnExport").onclick = () => {
    const t = cur();
    $("expTexto").value = [t.cols.map((c) => csvCell(c.name)).join(",")]
      .concat(view(t).map((r) => t.cols.map((c) => csvCell(shown(t, r, c))).join(",")))
      .join("\n");
    $("expCopiar").textContent = "Copiar";
    $("expMsg").textContent = "";
    $("dlgExport").showModal();
  };
  $("expDesc").onclick = async () => {
    if (await guardarArchivo((cur().name || "tabla") + ".csv", "\uFEFF" + $("expTexto").value, $("expMsg")))
      $("expMsg").textContent = "Archivo descargado.";
  };
  $("expCopiar").onclick = () => {
    const ta = $("expTexto"),
      ok = () => {
        $("expCopiar").textContent = "Copiado";
      },
      sel = () => {
        ta.focus();
        ta.select();
        $("expCopiar").textContent = "Seleccionado: copia manualmente";
      };
    try {
      navigator.clipboard.writeText(ta.value).then(ok, sel);
    } catch (e) {
      sel();
    }
  };
  function openImport() {
    $("impNombre").value = "";
    $("impTexto").value = "";
    $("impArchivo").value = "";
    $("impError").textContent = "";
    $("dlgImport").showModal();
  }
  $("btnImport").onclick = openImport;
  $("btnImportVacio").onclick = openImport;
  $("impArchivo").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!$("impNombre").value) $("impNombre").value = f.name.replace(/\.[^.]+$/, "");
    const fr = new FileReader();
    fr.onload = () => {
      $("impTexto").value = fr.result;
    };
    fr.onerror = () => {
      $("impError").textContent = "No se pudo leer el archivo.";
    };
    fr.readAsText(f);
  };
  /* Importe escrito como 1250, 1,250.50 o $1,250.50. Devuelve null si no lo es.
     Un valor con ceros a la izquierda (01000) es un código, no una cantidad: se queda como texto. */
  function numCSV(v) {
    const m = /^(-)?\s*\$?\s*(-)?(\d{1,3}(?:,\d{3})+|\d+)?(\.\d+)?$/.exec(v);
    if (!m || (!m[3] && !m[4]) || (m[1] && m[2])) return null;
    const ent = m[3] || "0";
    if (/^0\d/.test(ent)) return null;
    const n = Number(ent.replace(/,/g, "") + (m[4] || ""));
    return Number.isFinite(n) ? (m[1] || m[2] ? -n : n) : null;
  }
  /* Fecha AAAA-MM-DD o día/mes/año; la devuelve como AAAA-MM-DD, o null si no lo es. */
  function fechaCSV(v) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(v);
    if (!m) return null;
    const d = +m[1],
      mes = +m[2];
    if (d < 1 || d > 31 || mes < 1 || mes > 12) return null;
    return m[3] + "-" + String(mes).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  $("formImport").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = parseCSV($("impTexto").value);
    if (data.length < 1) {
      $("impError").textContent = "Elige un archivo o pega el contenido.";
      return;
    }
    const head = data[0],
      body = data.slice(1),
      used = new Set();
    const cols = head.map((h, i) => {
      let name = (h.trim() || "Columna " + (i + 1)).replace(/[{}]/g, ""),
        n = name,
        k = 2;
      while (used.has(n.toLowerCase())) n = name + " " + k++;
      used.add(n.toLowerCase());
      const vals = body.map((r) => (r[i] || "").trim()).filter((v) => v !== "");
      const type =
        vals.length && vals.every((v) => numCSV(v) !== null)
          ? "number"
          : vals.length && vals.every((v) => fechaCSV(v) !== null)
            ? "date"
            : "text";
      return { id: "c_" + uid(), name: n, type };
    });
    const rows = body.map((r) => {
      const c = {};
      cols.forEach((col, i) => {
        const v = (r[i] || "").trim();
        if (v !== "") c[col.id] = col.type === "number" ? numCSV(v) : col.type === "date" ? fechaCSV(v) : v;
      });
      return { id: "r_" + uid(), c };
    });
    let name = $("impNombre").value.trim() || "Importada",
      n = name,
      k = 2;
    while (state.tables.some((t) => t.name === n)) n = name + " " + k++;
    const t = { id: "t_" + uid(), name: n, cols, rows };
    snap();
    state.tables.push(t);
    $("dlgImport").close();
    dirty();
    goTab(t.id);
  });

  /* ---------- tabla y ajustes ---------- */
  $("btnTabla").onclick = () => {
    $("tabNombre").value = cur().name;
    disarm($("tabBorrar"), "Eliminar tabla");
    $("dlgTabla").showModal();
  };
  $("formTabla").addEventListener("submit", (e) => {
    e.preventDefault();
    const n = $("tabNombre").value.trim();
    if (n && n !== cur().name) {
      snap();
      cur().name = n;
    }
    $("dlgTabla").close();
    save();
    render();
  });
  $("tabBorrar").onclick = () =>
    arm($("tabBorrar"), "Eliminar tabla", () => {
      snap();
      state.tables = state.tables.filter((t) => t.id !== ui.tab);
      $("dlgTabla").close();
      dirty();
      goTab(state.tables[0] && state.tables[0].id);
    });
  $("btnBlanco").onclick = () => {
    snap();
    state.tables = state.tables.filter((t) => !["t_ven", "t_cli", "t_pro"].includes(t.id));
    state.demo = false;
    dirty();
    goTab(state.tables[0] && state.tables[0].id);
  };

  const root = document.documentElement,
    mq = matchMedia("(prefers-color-scheme: dark)");
  function applyPrefs() {
    const p = state.prefs,
      sysDark = root.dataset.theme ? root.dataset.theme === "dark" : mq.matches,
      dark = p.tema === "oscuro" || (p.tema === "sistema" && sysDark);
    const want = p.tema === "sistema" && !p.hc ? "" : (p.hc ? "hc-" : "") + (dark ? "dark" : "light");
    if (want) {
      if (root.dataset.ui !== want) root.dataset.ui = want;
    } else if ("ui" in root.dataset) delete root.dataset.ui;
    root.dataset.numcolor = p.numcolor ? "on" : "off";
    root.style.setProperty("--zt", p.zt / 100);
    root.style.setProperty("--zn", p.zn / 100);
    root.style.setProperty(
      "--rowh",
      Math.max(36, Math.round(((40 * p.zt) / 100) * Math.max(1, p.zn / 100))) + "px",
    );
  }
  if (mq.addEventListener) mq.addEventListener("change", applyPrefs);
  new MutationObserver(applyPrefs).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  $("btnAjustes").onclick = () => {
    const p = state.prefs;
    document.querySelectorAll("input[name=tema]").forEach((r) => {
      r.checked = r.value === p.tema;
    });
    $("ajHc").checked = p.hc;
    $("ajNum").checked = p.numcolor;
    syncFmt();
    $("dlgAjustes").showModal();
  };
  $("dlgAjustes").addEventListener("change", () => {
    const p = state.prefs,
      r = document.querySelector("input[name=tema]:checked");
    if (r) p.tema = r.value;
    p.hc = $("ajHc").checked;
    p.numcolor = $("ajNum").checked;
    applyPrefs();
    save();
  });
  $("ajDemo").onclick = () => {
    snap();
    state.tables = state.tables.filter((t) => t.id !== "t_ven" && t.id !== "t_cli" && t.id !== "t_pro");
    state.tables = ejemplo().concat(state.tables);
    state.demo = true;
    $("dlgAjustes").close();
    dirty();
    goTab("t_ven");
  };

  let toastT, undo;
  function toast(msg, fn, label) {
    $("toastTxt").textContent = msg;
    undo = fn;
    $("toastBtn").textContent = label || "Deshacer";
    /* Un diálogo abierto tapa todo lo que está fuera de él: el aviso se muestra dentro del que esté encima. */
    const abiertos = document.querySelectorAll("dialog[open]"),
      casa = abiertos.length ? abiertos[abiertos.length - 1] : document.body;
    if ($("toast").parentElement !== casa) casa.appendChild($("toast"));
    $("toast").hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      $("toast").hidden = true;
    }, 5000);
  }
  $("toastBtn").onclick = () => {
    $("toast").hidden = true;
    if (undo) undo();
  };

  /* ---------- selección, formato y vista de impresión ---------- */
  function setSel(td) {
    if (!td) return;
    const tr = td.closest("tr");
    if (!tr || !tr.dataset.id) return;
    const o = $("grid").querySelector("td.sel");
    if (o) o.classList.remove("sel");
    td.classList.add("sel");
    sel = { row: tr.dataset.id, col: td.dataset.c };
  }
  $("grid").addEventListener("focusin", (e) => setSel(e.target.closest("td[data-c]")));
  $("grid").addEventListener("click", (e) => setSel(e.target.closest("td[data-c]")));
  const selKey = (sc) => (sc === "cells" ? sel.row + "|" + sel.col : sc === "rows" ? sel.row : sel.col);
  function syncFmt() {
    const t = cur(),
      r = t && sel && rowIndex(t).get(sel.row),
      c = t && sel && colById(t, sel.col),
      ok = !!(r && c);
    $("selTxt").textContent = ok
      ? "Selección: " + c.name + " · " + (String(shown(t, r, t.cols[0])) || "fila sin nombre")
      : "Toca una celda de la tabla y vuelve aquí.";
    document.querySelectorAll("[data-fmt]").forEach((b) => {
      const x = b.dataset.fmt.split(":");
      b.disabled = !ok;
      b.setAttribute("aria-pressed", String(ok && !!(t.fmt && (t.fmt[x[1]][selKey(x[1])] || {})[x[0]])));
    });
    $("fmtClear").disabled = !(t && t.fmt);
    $("ajLibro").value = book().name;
    disarm($("ajLibroDel"), "Eliminar libro");
    $("ajLibroDel").disabled = state.books.length < 2;
    $("ajDemo").hidden = book().id !== "b_ej";
    $("ajBakInfo").textContent = state.prefs.bak
      ? "Último respaldo: " +
        new Date(state.prefs.bak).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) +
        "."
      : "Aún no has creado un respaldo.";
    $("ztV").textContent = state.prefs.zt + "%";
    $("znV").textContent = state.prefs.zn + "%";
  }
  $("dlgAjustes").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const t = cur();
    if (b.dataset.z) {
      const x = b.dataset.z.split(":"),
        p = state.prefs;
      p[x[0]] = Math.min(200, Math.max(80, p[x[0]] + Number(x[1])));
      applyPrefs();
      save();
      syncFmt();
    } else if (b.dataset.fmt && t && sel) {
      const x = b.dataset.fmt.split(":"),
        k = selKey(x[1]);
      snap();
      const f = t.fmt || (t.fmt = { cells: {}, rows: {}, cols: {} }),
        o = f[x[1]][k] || (f[x[1]][k] = {});
      o[x[0]] = !o[x[0]];
      if (!o.b && !o.h) delete f[x[1]][k];
      save();
      render();
      syncFmt();
    }
  });
  $("fmtClear").onclick = () => {
    const t = cur();
    if (!t || !t.fmt) return;
    snap();
    delete t.fmt;
    save();
    render();
    syncFmt();
  };
  function syncPrint() {
    const p = state.prefs;
    $("prHl").checked = p.pHl;
    $("prBd").checked = p.pBd;
    $("prHoja").classList.toggle("nohl", !p.pHl);
    $("prHoja").classList.toggle("nobd", !p.pBd);
    syncHoja();
  }
  $("prHl").onchange = $("prBd").onchange = () => {
    state.prefs.pHl = $("prHl").checked;
    state.prefs.pBd = $("prBd").checked;
    save();
    syncPrint();
  };
  $("ajPrint").onclick = () => {
    const t = cur();
    if (!t) return;
    const rows = view(t),
      MAX = 500;
    const numCol = (c) => c.type === "number" || c.type === "formula" || c.type === "sum";
    let h =
      "<thead><tr>" +
      t.cols
        .map((c) => '<th scope="col"' + (numCol(c) ? ' class="n"' : "") + ">" + esc(c.name) + "</th>")
        .join("") +
      "</tr></thead><tbody>";
    rows.slice(0, MAX).forEach((r) => {
      h +=
        "<tr>" +
        t.cols
          .map((c) => {
            const v = shown(t, r, c);
            return (
              '<td class="' +
              (typeof v === "number" ? "n " + numCls(v) : String(v).length <= 16 ? "nb" : "") +
              fcls(t, r, c).replace(" sel", "") +
              '">' +
              esc(fmt(v)) +
              "</td>"
            );
          })
          .join("") +
        "</tr>";
    });
    $("prTabla").innerHTML = h + "</tbody><tfoot>" + pieFila(t, rows, true) + "</tfoot>";
    $("prTitulo").textContent = t.name;
    $("prMeta").textContent =
      new Date().toLocaleDateString("es-MX", { dateStyle: "long" }) +
      " · " +
      rows.length +
      (rows.length === 1 ? " fila" : " filas");
    $("prNota").textContent =
      (rows.length > MAX ? "Se muestran las primeras " + MAX + " filas. " : "") +
      (NATIVO
        ? ""
        : "Vista previa: dentro de Claude no se puede abrir el diálogo de impresión. Usa la web publicada para imprimir.");
    syncPrint();
    $("dlgAjustes").close();
    $("dlgPrint").showModal();
  };

  /* ---------- opciones de selección ---------- */
  let optSel = null;
  function openOpt(rowId, colId) {
    optSel = { rowId, c: colById(cur(), colId) };
    $("optTitulo").textContent = optSel.c.name;
    $("optAyuda").textContent = optSel.c.type === "multi" ? "Puedes elegir varias." : "Elige una.";
    $("optNueva").value = "";
    drawOpt();
    $("dlgOpt").showModal();
  }
  function drawOpt() {
    const r = rowIndex(cur()).get(optSel.rowId),
      a = optVals(r, optSel.c),
      lista = optSel.c.options || [],
      o = lista.concat(a.filter((x) => !lista.includes(x)));
    optSel.lista = o;
    $("optLista").innerHTML = o.length
      ? o
          .map(
            (x, i) =>
              '<button type="button" data-i="' +
              i +
              '" aria-pressed="' +
              a.includes(x) +
              '"><span class="nch" aria-hidden="true" style="display:inline-block">' +
              (a.includes(x) ? "✓" : "") +
              "</span> " +
              esc(x) +
              (lista.includes(x) ? "" : ' <span class="vac">(ya no está en la lista)</span>') +
              "</button>",
          )
          .join("")
      : '<button type="button" disabled>Sin opciones todavía</button>';
  }
  function setOpt(o) {
    const r = rowIndex(cur()).get(optSel.rowId),
      c = optSel.c;
    if (c.type === "multi") {
      const a = optVals(r, c).slice(),
        i = a.indexOf(o);
      if (i < 0) a.push(o);
      else a.splice(i, 1);
      if (a.length) r.c[c.id] = a;
      else delete r.c[c.id];
      save();
      render();
      drawOpt();
    } else {
      r.c[c.id] = o;
      $("dlgOpt").close();
      save();
      render();
    }
  }
  $("optLista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    snap();
    setOpt(optSel.lista[+b.dataset.i]);
  });
  $("optCrear").onclick = () => {
    const n = $("optNueva").value.trim();
    if (!n) return;
    snap();
    const c = optSel.c;
    c.options = c.options || [];
    if (!c.options.includes(n)) c.options.push(n);
    $("optNueva").value = "";
    const had = optVals(rowIndex(cur()).get(optSel.rowId), c).includes(n);
    if (!had) setOpt(n);
    else drawOpt();
  };
  $("optNueva").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("optCrear").click();
    }
  });
  $("optQuitar").onclick = () => {
    const r = rowIndex(cur()).get(optSel.rowId);
    snap();
    delete r.c[optSel.c.id];
    $("dlgOpt").close();
    save();
    render();
  };

  /* ---------- salas y libros: renombrar, mover, crear, eliminar ---------- */
  function ubicar(key, nodes, padre) {
    nodes = nodes || state.tree;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i],
        k = n.kind === "book" ? "b:" + n.book : "r:" + n.id;
      if (k === key) return { arr: nodes, i, node: n, padre: padre || null };
      if (n.children) {
        const r = ubicar(key, n.children, n);
        if (r) return r;
      }
    }
    return null;
  }
  let nodoKey = "";
  function openNodo(key) {
    const u = ubicar(key);
    if (!u) return;
    nodoKey = key;
    const n = u.node,
      esLibro = n.kind === "book",
      raiz = !u.padre,
      bk = esLibro && state.books.find((b) => b.id === n.book);
    $("nodoT").textContent = esLibro ? "Libro" : raiz ? "Sección" : "Sala";
    $("nodoNombre").value = esLibro ? (bk ? bk.name : "") : n.name;
    const op = [];
    (function rec(nodes, d) {
      nodes.forEach((x) => {
        if (x.kind === "book" || x === n) return;
        op.push('<option value="' + x.id + '">' + "\u00a0\u00a0".repeat(d) + esc(x.name) + "</option>");
        rec(x.children, d + 1);
      });
    })(state.tree, 0);
    $("nodoDest").innerHTML = op.join("");
    if (u.padre) $("nodoDest").value = u.padre.id;
    $("nodoDestL").hidden = raiz;
    $("nodoOrden").hidden = raiz;
    $("nodoDel").hidden = raiz;
    $("nodoCrear").hidden = esLibro;
    $("nodoUp").disabled = u.i === 0;
    $("nodoDown").disabled = u.i === u.arr.length - 1;
    disarm($("nodoDel"), "Eliminar");
    $("nodoError").textContent = "";
    $("dlgNodo").showModal();
  }
  function tocaArbol() {
    save();
    renderNav();
    titulo();
  }
  $("formNodo").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = ubicar(nodoKey);
    if (!u) return;
    const n = u.node,
      nom = $("nodoNombre").value.trim();
    if (!nom) {
      $("nodoError").textContent = "Escribe un nombre.";
      return;
    }
    if (n.kind === "book") {
      const bk = state.books.find((b) => b.id === n.book);
      if (bk) bk.name = nom;
    } else n.name = nom;
    const dest = u.padre && $("nodoDest").value !== u.padre.id && findNode($("nodoDest").value);
    if (dest) {
      u.arr.splice(u.i, 1);
      dest.children.push(n);
      dest.open = true;
    }
    $("dlgNodo").close();
    tocaArbol();
  });
  function moverNodo(d) {
    const u = ubicar(nodoKey);
    if (!u) return;
    const j = u.i + d;
    if (j < 0 || j >= u.arr.length) return;
    u.arr.splice(u.i, 1);
    u.arr.splice(j, 0, u.node);
    tocaArbol();
    $("nodoUp").disabled = j === 0;
    $("nodoDown").disabled = j === u.arr.length - 1;
  }
  $("nodoUp").onclick = () => moverNodo(-1);
  $("nodoDown").onclick = () => moverNodo(1);
  $("nodoSala").onclick = () => {
    const u = ubicar(nodoKey);
    if (!u) return;
    const id = "rm_" + uid();
    u.node.children.push({ id, kind: "room", name: "Sala nueva", open: true, children: [] });
    u.node.open = true;
    $("dlgNodo").close();
    tocaArbol();
    openNodo("r:" + id);
    $("nodoNombre").select();
  };
  $("nodoLibro").onclick = () => {
    const u = ubicar(nodoKey);
    if (!u) return;
    let k = 1;
    while (state.books.some((x) => x.name === "Libro " + k)) k++;
    const id = "b_" + uid();
    state.books.push({ id, name: "Libro " + k, tables: [] });
    u.node.children.push({ kind: "book", book: id });
    u.node.open = true;
    $("dlgNodo").close();
    $("dlgNav").close();
    irLibro(id);
    mostrar("libro");
  };
  $("nodoDel").onclick = () => {
    const u = ubicar(nodoKey);
    if (!u) return;
    const n = u.node;
    if (n.kind !== "book" && n.children.length) {
      $("nodoError").textContent = "La sala tiene contenido. Mueve o elimina primero sus libros y subsalas.";
      return;
    }
    if (n.kind === "book" && state.books.length < 2) {
      $("nodoError").textContent = "Debe quedar al menos un libro.";
      return;
    }
    arm($("nodoDel"), "Eliminar", () => {
      u.arr.splice(u.i, 1);
      $("dlgNodo").close();
      if (n.kind === "book") {
        const era = book().id === n.book;
        state.books = state.books.filter((b) => b.id !== n.book);
        if (era) {
          irLibro(state.books[0].id);
          renderNav();
          return;
        }
      }
      tocaArbol();
    });
  };

  /* ---------- descargas y respaldo completo ---------- */
  let dl = null;
  const NATIVO = !(window.claude && typeof window.claude.use === "function");
  function conDescargas() {
    document.querySelectorAll("[data-dl]").forEach((b) => {
      b.hidden = !(dl || NATIVO);
    });
    document.querySelectorAll("[data-nativo]").forEach((b) => {
      b.hidden = !NATIVO;
    });
  }
  function bajarNativo(filename, data) {
    const u = URL.createObjectURL(new Blob([data], { type: "application/octet-stream" })),
      a = document.createElement("a");
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
  }
  function imprimir(el) {
    const a = $("printArea");
    a.innerHTML = "";
    a.appendChild(el.cloneNode(true));
    let css = $("hojaCss");
    if (!css) {
      css = document.createElement("style");
      css.id = "hojaCss";
      document.head.appendChild(css);
    }
    css.textContent =
      "@page{size:letter " +
      (state.prefs.hoja === "h" ? "landscape" : "portrait") +
      ';margin:12mm 12mm 14mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px sans-serif;color:#555}}';
    document.body.classList.add("printing");
    const fin = () => {
      document.body.classList.remove("printing");
      a.innerHTML = "";
      window.removeEventListener("afterprint", fin);
    };
    window.addEventListener("afterprint", fin);
    window.print();
  }
  if (NATIVO && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (window.claude && typeof window.claude.use === "function")
    window.claude
      .use("downloads")
      .then((x) => {
        dl = x;
        conDescargas();
      })
      .catch(() => {});
  async function guardarArchivo(filename, data, msg) {
    if (!dl) {
      if (NATIVO) {
        bajarNativo(filename, data);
        return true;
      }
      return false;
    }
    try {
      await dl.save({ filename, data });
      return true;
    } catch (e) {
      const c = e && e.code;
      msg.textContent =
        c === "declined"
          ? "No se guardó: cancelaste la descarga."
          : c === "rate_limited"
            ? "Ya hay una descarga abierta. Espera un momento e inténtalo otra vez."
            : "Aquí no se pudo descargar. Usa Copiar.";
      return false;
    }
  }
  function resumenEstado(st) {
    let t = 0,
      f = 0;
    st.books.forEach((b) => {
      t += b.tables.length;
      b.tables.forEach((x) => {
        f += (x.rows || []).length;
      });
    });
    return (
      st.books.length +
      (st.books.length === 1 ? " libro, " : " libros, ") +
      t +
      " tablas, " +
      f +
      " filas y " +
      (st.reports || []).length +
      " reportes"
    );
  }
  const textoRespaldo = () =>
    JSON.stringify({ app: "bases-unificadas", formato: 1, creado: new Date().toISOString(), state });
  function marcaRespaldo() {
    state.prefs.bak = new Date().toISOString();
    save();
    syncFmt();
  }
  $("ajBak").onclick = () => {
    $("bakInfo").textContent = "Incluye " + resumenEstado(state) + ".";
    $("bakMsg").textContent = "";
    $("bakTexto").hidden = true;
    conDescargas();
    $("dlgAjustes").close();
    $("dlgBak").showModal();
  };
  $("bakDesc").onclick = async () => {
    const d = new Date(),
      f =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0");
    if (await guardarArchivo("bases-unificadas-respaldo-" + f + ".json", textoRespaldo(), $("bakMsg"))) {
      $("bakMsg").textContent = "Respaldo descargado.";
      marcaRespaldo();
    }
  };
  $("bakCopiar").onclick = () => {
    const txt = textoRespaldo(),
      ok = () => {
        $("bakMsg").textContent = "Copiado. Pégalo en una nota o en un archivo y guárdalo.";
        marcaRespaldo();
      },
      sel = () => {
        const ta = $("bakTexto");
        ta.hidden = false;
        ta.value = txt;
        ta.focus();
        ta.select();
        $("bakMsg").textContent = "Texto seleccionado: cópialo manualmente.";
      };
    try {
      navigator.clipboard.writeText(txt).then(ok, sel);
    } catch (e) {
      sel();
    }
  };
  /* Revisa un respaldo antes de usarlo: los identificadores solo pueden llevar letras, números, guion y
     guion bajo (así ningún archivo ajeno puede meter código en la página) y cada parte debe tener su forma.
     Corrige lo que se puede corregir y devuelve false si el respaldo no es confiable. */
  const TIPOS = [
    "text",
    "number",
    "date",
    "select",
    "multi",
    "check",
    "relation",
    "lookup",
    "formula",
    "sum",
  ];
  function revisarEstado(st) {
    const id = (x) => typeof x === "string" && /^[\w-]{1,60}$/.test(x),
      obj = (x) => !!x && typeof x === "object" && !Array.isArray(x),
      txt = (x, d) => (x == null ? d : String(x)),
      num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    if (!obj(st) || !Array.isArray(st.books)) return false;
    for (const b of st.books) {
      if (!obj(b) || !id(b.id) || !Array.isArray(b.tables)) return false;
      b.name = txt(b.name, "Libro");
      for (const t of b.tables) {
        if (!obj(t) || !id(t.id) || !Array.isArray(t.cols) || !Array.isArray(t.rows)) return false;
        t.name = txt(t.name, "Tabla");
        for (const c of t.cols) {
          if (!obj(c) || !id(c.id) || !TIPOS.includes(c.type)) return false;
          c.name = txt(c.name, "");
          if (c.options !== undefined) c.options = Array.isArray(c.options) ? c.options.map(String) : [];
          if (c.type === "formula") c.expr = txt(c.expr, "");
          if (c.pie !== undefined && !["sum", "avg", "count"].includes(c.pie)) delete c.pie;
        }
        for (const r of t.rows) {
          if (!obj(r) || !id(r.id)) return false;
          if (!obj(r.c)) r.c = {};
        }
        if (t.fmt !== undefined && !(obj(t.fmt) && obj(t.fmt.cells) && obj(t.fmt.rows) && obj(t.fmt.cols)))
          delete t.fmt;
        if (t.view !== undefined && !obj(t.view)) delete t.view;
        if (t.plantillas !== undefined) {
          t.plantillas = (Array.isArray(t.plantillas) ? t.plantillas : [])
            .filter((x) => obj(x) && id(x.id))
            .map((x) => ({
              id: x.id,
              name: txt(x.name, "Plantilla"),
              g: txt(x.g, ""),
              g2: txt(x.g2, ""),
              s: txt(x.s, ""),
              det: !!x.det,
              pal: txt(x.pal, "tinta"),
              hoja: x.hoja === "h" ? "h" : "v",
            }));
          if (!t.plantillas.length) delete t.plantillas;
        }
        if (t.vistas !== undefined) {
          const ord = (x) =>
            obj(x) && x.col ? { col: txt(x.col, ""), dir: x.dir === -1 ? -1 : 1 } : { col: "", dir: 1 };
          t.vistas = (Array.isArray(t.vistas) ? t.vistas : [])
            .filter((v) => obj(v) && id(v.id))
            .map((v) => ({
              id: v.id,
              name: txt(v.name, "Vista"),
              q: txt(v.q, ""),
              f:
                obj(v.f) && v.f.col
                  ? {
                      col: txt(v.f.col, ""),
                      op: ["has", "eq", "gt", "lt"].includes(v.f.op) ? v.f.op : "has",
                      val: txt(v.f.val, ""),
                    }
                  : { col: "", op: "has", val: "" },
              s: ord(v.s),
              s2: ord(v.s2),
            }));
          if (!t.vistas.length) delete t.vistas;
        }
      }
    }
    const nodo = (n, raiz) => {
      if (!obj(n)) return false;
      if (n.kind === "book") return !raiz && id(n.book);
      if (!id(n.id) || !Array.isArray(n.children)) return false;
      n.kind = "room";
      n.name = txt(n.name, "Sala");
      return n.children.every((x) => nodo(x, false));
    };
    if (
      st.tree !== undefined &&
      !(Array.isArray(st.tree) && st.tree.length && st.tree.every((n) => nodo(n, true)))
    )
      delete st.tree;
    if (st.prefs !== undefined && !obj(st.prefs)) delete st.prefs;
    st.reports = (Array.isArray(st.reports) ? st.reports : []).filter((r) => {
      if (!obj(r) || !id(r.id) || !obj(r.data) || !Array.isArray(r.data.groups)) return false;
      const d = r.data;
      d.n = num(d.n);
      d.ncols = num(d.ncols);
      d.mas = num(d.mas);
      if (d.total !== null) d.total = num(d.total);
      d.gName = txt(d.gName, "");
      d.sName = txt(d.sName, "");
      const grupo = (o) => ({ k: txt(o.k, ""), n: num(o.n), sum: num(o.sum) });
      d.g2Name = txt(d.g2Name, "");
      d.groups = d.groups.filter(obj).map((o) => {
        const x = grupo(o);
        if (Array.isArray(o.sub)) x.sub = o.sub.filter(obj).map(grupo);
        return x;
      });
      if (d.pie !== undefined) {
        if (Array.isArray(d.pie))
          d.pie = d.pie.map((o) => (obj(o) ? { l: txt(o.l, ""), v: txt(o.v, "") } : null));
        else delete d.pie;
      }
      if (d.head !== undefined) {
        if (!Array.isArray(d.head) || !Array.isArray(d.body) || !d.body.every(Array.isArray)) return false;
        if (!Array.isArray(d.num)) d.num = [];
      }
      r.ruta = Array.isArray(r.ruta) ? r.ruta.map(String) : [];
      ["title", "bookName", "tableName", "filtro", "orden", "pal"].forEach((k) => {
        r[k] = txt(r[k], "");
      });
      return true;
    });
    return true;
  }
  /* Todo libro debe aparecer en la barra lateral: los que falten entran a la primera sección. */
  function completarArbol() {
    const vistos = new Set();
    (function rec(nodes) {
      nodes.forEach((n) => (n.kind === "book" ? vistos.add(n.book) : rec(n.children)));
    })(state.tree);
    state.books.forEach((b) => {
      if (!vistos.has(b.id)) state.tree[0].children.push({ kind: "book", book: b.id });
    });
  }
  let resDatos = null;
  function leerRespaldo() {
    resDatos = null;
    $("resError").textContent = "";
    $("resInfo").textContent = "";
    $("resOk").disabled = true;
    disarm($("resOk"), "Restaurar");
    const txt = $("resTexto").value.trim();
    if (!txt) return;
    let d;
    try {
      d = JSON.parse(txt);
    } catch (e) {
      $("resError").textContent = "El texto no es un respaldo válido o está incompleto.";
      return;
    }
    if (
      !d ||
      d.app !== "bases-unificadas" ||
      !d.state ||
      !Array.isArray(d.state.books) ||
      !d.state.books.every((b) => b && Array.isArray(b.tables))
    ) {
      $("resError").textContent = "Este archivo no es un respaldo de Bases unificadas.";
      return;
    }
    if (!revisarEstado(d.state)) {
      $("resError").textContent = "Este respaldo está dañado o fue modificado, y no se puede restaurar.";
      return;
    }
    resDatos = d;
    $("resOk").disabled = false;
    $("resInfo").textContent =
      "Respaldo del " +
      new Date(d.creado).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) +
      ": " +
      resumenEstado(d.state) +
      ".";
  }
  $("ajRes").onclick = () => {
    $("resTexto").value = "";
    $("resArchivo").value = "";
    leerRespaldo();
    $("dlgAjustes").close();
    $("dlgRes").showModal();
  };
  $("resTexto").addEventListener("input", leerRespaldo);
  $("resArchivo").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      $("resTexto").value = fr.result;
      leerRespaldo();
    };
    fr.onerror = () => {
      $("resError").textContent = "No se pudo leer el archivo.";
    };
    fr.readAsText(f);
  };
  $("resOk").onclick = () => {
    if (!resDatos) return;
    if (!$("resOk").dataset.armed) {
      $("resOk").dataset.armed = "1";
      $("resOk").textContent = "Toca otra vez: reemplaza todo";
      return;
    }
    const st = resDatos.state;
    Object.keys(state).forEach((k) => {
      delete state[k];
    });
    Object.assign(state, st);
    if (!Array.isArray(state.reports)) state.reports = [];
    if (!state.books.length) state.books.push({ id: "b_" + uid(), name: "Libro 1", tables: [] });
    if (!Array.isArray(state.tree))
      state.tree = [
        {
          id: "sec_per",
          kind: "room",
          name: "Personal",
          open: true,
          children: state.books.map((b) => ({ kind: "book", book: b.id })),
        },
      ];
    state.prefs = Object.assign(
      { tema: "sistema", hc: false, numcolor: true, zt: 100, zn: 100, pHl: true, pBd: true },
      state.prefs || {},
    );
    completarArbol();
    if (!state.books.some((b) => b.id === state.cur)) state.cur = state.books[0].id;
    idx.clear();
    agg.clear();
    undoS.length = 0;
    redoS.length = 0;
    botones();
    applyPrefs();
    save();
    $("dlgRes").close();
    goTab(state.tables[0] && state.tables[0].id);
    toast("Respaldo restaurado", () => {}, "Listo");
  };

  /* ---------- reportes ---------- */
  if (!Array.isArray(state.reports)) state.reports = [];
  const PALS = [
    ["tinta", "Tinta", "#111111"],
    ["marino", "Marino", "#1d3557"],
    ["bosque", "Bosque", "#24543a"],
    ["vino", "Vino", "#6b1f33"],
    ["ambar", "Ámbar", "#7a4f00"],
    ["noche", "Noche", "#14161a"],
  ];
  const palDe = (id) => PALS.find((p) => p[0] === id) || PALS[0];
  const esNum = (c) => ["number", "formula", "sum"].includes(c.type);
  let rep = null;
  function rutaLibro(id, nodes, path) {
    for (const n of nodes || state.tree) {
      if (n.kind === "book") {
        if (n.book === id) return path || [];
      } else {
        const r = rutaLibro(id, n.children, (path || []).concat(n.name));
        if (r) return r;
      }
    }
    return null;
  }
  function descVista(t) {
    const f = [];
    if (ui.q.trim()) f.push('Búsqueda "' + ui.q.trim() + '"');
    const fc = ui.f.col && colById(t, ui.f.col);
    if (fc && ui.f.val !== "")
      f.push(
        fc.name +
          " " +
          { has: "contiene", eq: "es igual a", gt: "mayor que", lt: "menor que" }[ui.f.op] +
          " " +
          ui.f.val,
      );
    const o = [ui.sort, ui.sort2]
      .map((x) => {
        const c = x.col && colById(t, x.col);
        return c ? c.name + (x.dir > 0 ? " ↑" : " ↓") : "";
      })
      .filter(Boolean);
    return { filtro: f.join(" · ") || "Sin filtro", orden: o.join(", ") || "Sin orden" };
  }
  function datosRep(t, g, s, det, g2) {
    const rows = view(t),
      gc = g && colById(t, g),
      g2c = gc && g2 && g2 !== g && colById(t, g2),
      sc = s && colById(t, s),
      m = new Map();
    let total = 0;
    rows.forEach((r) => {
      const v = sc ? val(t, r, sc) : 0,
        x = typeof v === "number" ? v : 0;
      total += x;
      if (gc) {
        const k = String(shown(t, r, gc)) || "(sin dato)",
          o = m.get(k) || { k, n: 0, sum: 0, sub: g2c ? new Map() : null };
        o.n++;
        o.sum += x;
        m.set(k, o);
        if (g2c) {
          const k2 = String(shown(t, r, g2c)) || "(sin dato)",
            o2 = o.sub.get(k2) || { k: k2, n: 0, sum: 0 };
          o2.n++;
          o2.sum += x;
          o.sub.set(k2, o2);
        }
      }
    });
    const orden = (a, b) => b.sum - a.sum || b.n - a.n || a.k.localeCompare(b.k, "es"),
      r2 = (o) => {
        o.sum = Math.round(o.sum * 100) / 100;
      };
    const groups = [...m.values()];
    groups.forEach((o) => {
      r2(o);
      if (o.sub) {
        o.sub = [...o.sub.values()];
        o.sub.forEach(r2);
        o.sub.sort(orden);
      } else delete o.sub;
    });
    groups.sort(orden);
    const MAX = 500,
      d = {
        n: rows.length,
        ncols: t.cols.length,
        total: sc ? Math.round(total * 100) / 100 : null,
        gName: gc ? gc.name : "",
        g2Name: g2c ? g2c.name : "",
        sName: sc ? sc.name : "",
        groups,
      };
    if (det) {
      d.head = t.cols.map((c) => c.name);
      d.num = t.cols.map(esNum);
      d.body = rows.slice(0, MAX).map((r) => t.cols.map((c) => String(fmt(shown(t, r, c)))));
      d.mas = Math.max(0, rows.length - MAX);
      /* Totales al final del detalle: el que cada columna tenga elegido al pie de su tabla y, si no
         eligió ninguno, la suma de la columna que el reporte suma. Usan todas las filas, no solo las 500. */
      const pie = t.cols.map((c) => {
        const o = c.pie ? totalDe(t, rows, c) : sc && c.id === sc.id ? { l: "Suma", v: d.total } : null;
        return o ? { l: o.l, v: o.v === "" ? "sin datos" : String(fmt(o.v)) } : null;
      });
      if (pie.some(Boolean)) d.pie = pie;
    }
    return d;
  }
  function fechaTxt(at) {
    const d = new Date(at);
    return {
      dia: d.toLocaleDateString("es-MX", { weekday: "long" }),
      fecha: d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }),
      hora: d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }),
    };
  }
  function pintarRep() {
    const r = rep.r,
      d = r.data,
      f = fechaTxt(r.at || Date.now());
    $("repHoja").dataset.pal = r.pal;
    const usaSuma = d.total !== null && d.groups.some((o) => o.sum !== 0),
      max = Math.max(1, ...d.groups.map((o) => Math.abs(usaSuma ? o.sum : o.n)));
    let h =
      '<div class="rp-head"><p class="rp-eye">Reporte</p><h2>' +
      esc(r.title || "Sin título") +
      '</h2><p class="rp-meta">' +
      esc(f.fecha + " · " + f.hora + " · " + r.bookName + " › " + r.tableName) +
      '</p></div><div class="rp-body">';
    h +=
      '<div class="rp-tiles"><div class="rp-tile"><b>' +
      esc(fmt(d.n)) +
      "</b><span>Registros</span></div>" +
      (d.total !== null
        ? '<div class="rp-tile"><b>' +
          esc(fmt(d.total)) +
          "</b><span>Total de " +
          esc(d.sName) +
          "</span></div>"
        : "") +
      (d.gName
        ? '<div class="rp-tile"><b>' +
          d.groups.length +
          "</b><span>" +
          esc(d.gName) +
          ": valores distintos</span></div>"
        : "") +
      "</div>";
    const fila = (o, cls) =>
      '<span class="' +
      cls +
      '">' +
      esc(o.k) +
      '</span><span class="n ' +
      cls +
      '">' +
      o.n +
      (o.n === 1 ? " registro" : " registros") +
      '</span><span class="n ' +
      cls +
      '">' +
      (d.total !== null ? esc(fmt(o.sum)) : "") +
      "</span>";
    if (d.gName)
      h +=
        "<div><h3>Por " +
        esc(d.gName) +
        (d.g2Name ? " y " + esc(d.g2Name) : "") +
        '</h3><div class="rp-g">' +
        d.groups
          .map(
            (o) =>
              '<div class="rp-grp">' +
              fila(o, "") +
              '<span class="bar"><i style="width:' +
              Math.round((Math.abs(usaSuma ? o.sum : o.n) / max) * 100) +
              '%"></i></span>' +
              (o.sub ? o.sub.map((x) => fila(x, "sub")).join("") : "") +
              "</div>",
          )
          .join("") +
        "</div></div>";
    if (d.head)
      h +=
        '<div><h3>Detalle</h3><div class="rp-tw"><table><thead><tr class="rp-corre"><th colspan="' +
        d.head.length +
        '">' +
        esc((r.title || "Sin título") + " · " + r.bookName + " › " + r.tableName + " · " + f.fecha) +
        "</th></tr><tr>" +
        d.head
          .map((x, i) => '<th scope="col"' + (d.num[i] ? ' class="n"' : "") + ">" + esc(x) + "</th>")
          .join("") +
        "</tr></thead><tbody>" +
        d.body
          .map(
            (row) =>
              "<tr>" +
              row
                .map(
                  (x, i) =>
                    "<td" +
                    (d.num[i] ? ' class="n"' : x.length <= 16 ? ' class="nb"' : "") +
                    ">" +
                    esc(x) +
                    "</td>",
                )
                .join("") +
              "</tr>",
          )
          .join("") +
        "</tbody>" +
        (d.pie
          ? "<tfoot><tr>" +
            d.head
              .map((x, i) => {
                const o = d.pie[i];
                return o
                  ? '<td class="n"><span class="pie-l">' + esc(o.l) + "</span>" + esc(o.v) + "</td>"
                  : "<td></td>";
              })
              .join("") +
            "</tr></tfoot>"
          : "") +
        "</table></div>" +
        (d.mas
          ? '<p class="rp-foot" style="margin-top:8px">Faltan ' +
            d.mas +
            " filas que no caben en el detalle.</p>"
          : "") +
        "</div>";
    h += '<p class="rp-foot">' + esc("Filtro: " + r.filtro + " · Orden: " + r.orden) + "</p></div>";
    $("repHoja").innerHTML = h;
    $("repPal").innerHTML = PALS.map(
      (p) =>
        '<button type="button" class="palb" data-pal="' +
        p[0] +
        '" aria-pressed="' +
        (p[0] === r.pal) +
        '"><i style="background:' +
        p[2] +
        '"></i>' +
        p[1] +
        "</button>",
    ).join("");
    const ruta = (r.ruta || []).concat(r.bookName).join(" / ") + " › " + r.tableName;
    $("repInfo").innerHTML =
      '<p class="info-dia">' +
      esc(f.dia) +
      '</p><p class="info-fecha">' +
      esc(f.fecha + " | " + f.hora) +
      "</p>" +
      '<div class="info-card"><div class="info-row"><span>' +
      d.n +
      " filas</span><span>" +
      d.ncols +
      " columnas</span><span>" +
      (d.gName ? d.groups.length + " grupos" : "sin grupos") +
      "</span><span>" +
      (d.total !== null ? "total " + esc(fmt(d.total)) : "sin suma") +
      "</span></div>" +
      '<div class="info-row"><span>' +
      (d.gName ? "Agrupado por " + esc(d.gName) + (d.g2Name ? " y " + esc(d.g2Name) : "") : "Sin agrupar") +
      "</span><span>" +
      (d.sName ? "Suma " + esc(d.sName) : "") +
      "</span></div>" +
      '<div class="info-row"><span>' +
      esc(r.tableName) +
      '</span><span style="display:flex;gap:8px;flex-wrap:wrap"><span class="info-chip">' +
      esc(palDe(r.pal)[1]) +
      '</span><span class="info-chip">' +
      (d.head ? "Con detalle" : "Resumen") +
      "</span></span></div></div>" +
      '<div class="info-two"><div class="info-card"><h4>Origen</h4><p>' +
      esc(ruta) +
      '</p></div><div class="info-card"><h4>Nombre</h4><p>' +
      esc(r.title || "Sin título") +
      "</p></div></div>" +
      '<div class="info-two"><div class="info-card"><h4>Filtro</h4><p>' +
      esc(r.filtro) +
      '</p></div><div class="info-card"><h4>Orden</h4><p>' +
      esc(r.orden) +
      "</p></div></div>";
    $("repCtl").hidden = rep.saved;
    $("repGuardar").hidden = rep.saved;
    $("repInfoBtn").hidden = !rep.saved;
    $("repAcc").hidden = !rep.saved;
    $("repBarT").textContent = rep.saved ? "Reporte guardado" : "Nuevo reporte";
    $("repInfo").hidden = !(rep.saved && rep.info);
    $("repInfoBtn").setAttribute("aria-expanded", String(!!rep.info));
  }
  function recalcRep() {
    const t = tableById(rep.r.tableId);
    if (!t) return;
    rep.r.data = datosRep(t, rep.r.g, rep.r.s, rep.r.det, rep.r.g2);
    $("repG2").disabled = !rep.r.g;
    pintarRep();
  }
  $("btnRep").onclick = () => {
    const t = cur();
    if (!t) return;
    const dv = descVista(t),
      b = book();
    const g = (t.cols.slice(1).find((c) => ["select", "lookup", "relation"].includes(c.type)) || {}).id || "",
      s = (t.cols.find(esNum) || {}).id || "";
    rep = {
      saved: false,
      info: false,
      r: {
        id: "p_" + uid(),
        title: t.name + (ui.f.col && ui.f.val !== "" ? " · " + ui.f.val : ""),
        pal: state.prefs.pal || "tinta",
        bookId: b.id,
        bookName: b.name,
        ruta: rutaLibro(b.id) || [],
        tableId: t.id,
        tableName: t.name,
        filtro: dv.filtro,
        orden: dv.orden,
        g,
        g2: "",
        s,
        det: true,
      },
    };
    $("repTitulo").value = rep.r.title;
    $("repG").innerHTML = '<option value="">Sin agrupar</option>' + opts(t.cols);
    $("repG").value = g;
    $("repG2").innerHTML = '<option value="">Sin segundo desglose</option>' + opts(t.cols);
    $("repG2").value = "";
    llenarPl("");
    syncHoja();
    $("repS").innerHTML = '<option value="">Sin suma</option>' + opts(t.cols.filter(esNum));
    $("repS").value = s;
    $("repDet").checked = true;
    disarm($("repBorrar"), "Eliminar reporte");
    recalcRep();
    $("dlgRep").showModal();
  };
  $("repTitulo").addEventListener("input", (e) => {
    rep.r.title = e.target.value;
    pintarRep();
  });
  $("repG").onchange = (e) => {
    rep.r.g = e.target.value;
    recalcRep();
  };
  $("repG2").onchange = (e) => {
    rep.r.g2 = e.target.value;
    recalcRep();
  };
  $("repS").onchange = (e) => {
    rep.r.s = e.target.value;
    recalcRep();
  };

  /* ---------- plantillas de reporte ----------
     Una plantilla guarda cómo se arma un reporte (desgloses, suma, detalle, paleta y hoja), no sus datos.
     Vive en su tabla (t.plantillas) y se aplica sobre lo que esté en pantalla: cada mes se filtra la tabla,
     se elige la plantilla y el reporte sale igual que el anterior. */
  const sufijo = () => (hayFiltro() ? " · " + ui.f.val : "");
  function llenarPl(id) {
    const t = tableById(rep.r.tableId),
      ps = (t && t.plantillas) || [];
    $("repPl").innerHTML = '<option value="">Sin plantilla</option>' + opts(ps);
    $("repPl").value = ps.some((x) => x.id === id) ? id : "";
    $("repPlBorrar").hidden = !$("repPl").value;
  }
  $("repPl").onchange = () => {
    const t = tableById(rep.r.tableId),
      pl = (t.plantillas || []).find((x) => x.id === $("repPl").value),
      r = rep.r,
      col = (id) => (id && colById(t, id) ? id : "");
    $("repPlBorrar").hidden = !pl;
    $("repPlMsg").textContent = "";
    if (!pl) return;
    r.g = col(pl.g);
    r.g2 = col(pl.g2);
    r.s = col(pl.s);
    r.det = !!pl.det;
    r.pal = palDe(pl.pal)[0];
    r.title = pl.name + sufijo();
    state.prefs.pal = r.pal;
    state.prefs.hoja = pl.hoja === "h" ? "h" : "v";
    save();
    $("repTitulo").value = r.title;
    $("repG").value = r.g;
    $("repG2").value = r.g2;
    $("repS").value = r.s;
    $("repDet").checked = r.det;
    syncHoja();
    recalcRep();
  };
  $("repPlGuardar").onclick = () => {
    const t = tableById(rep.r.tableId),
      r = rep.r,
      suf = sufijo();
    let n = (r.title || "").trim();
    if (suf && n.endsWith(suf)) n = n.slice(0, -suf.length).trim();
    if (!n) {
      $("repPlMsg").textContent = "Escribe un título: será el nombre de la plantilla.";
      return;
    }
    snap();
    const ps = t.plantillas || (t.plantillas = []),
      cfg = { g: r.g, g2: r.g2, s: r.s, det: r.det, pal: r.pal, hoja: state.prefs.hoja === "h" ? "h" : "v" };
    let pl = ps.find((x) => x.name.toLowerCase() === n.toLowerCase());
    if (pl) Object.assign(pl, cfg);
    else ps.push((pl = Object.assign({ id: "pl_" + uid(), name: n }, cfg)));
    save();
    llenarPl(pl.id);
    $("repPlMsg").textContent =
      "Plantilla guardada: " + pl.name + ". La encontrarás aquí cada vez que hagas un reporte de esta tabla.";
  };
  $("repPlBorrar").onclick = () => {
    const t = tableById(rep.r.tableId),
      id = $("repPl").value;
    if (!id) return;
    snap();
    t.plantillas = t.plantillas.filter((x) => x.id !== id);
    if (!t.plantillas.length) delete t.plantillas;
    save();
    llenarPl("");
    $("repPlMsg").textContent = "";
    toast("Plantilla eliminada", () => {
      undoApp();
      llenarPl(id);
    });
  };

  /* ---------- hoja de impresión ----------
     Carta vertical u horizontal. Es una preferencia de quien imprime, no del reporte guardado. */
  function syncHoja() {
    const h = state.prefs.hoja === "h" ? "h" : "v";
    document.querySelectorAll("input[name=hojaRep], input[name=hojaTab]").forEach((x) => {
      x.checked = x.value === h;
    });
  }
  document.addEventListener("change", (e) => {
    if (e.target.name !== "hojaRep" && e.target.name !== "hojaTab") return;
    state.prefs.hoja = e.target.value;
    save();
    syncHoja();
  });
  $("repDet").onchange = (e) => {
    rep.r.det = e.target.checked;
    recalcRep();
  };
  $("repPal").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pal]");
    if (!b) return;
    rep.r.pal = b.dataset.pal;
    state.prefs.pal = b.dataset.pal;
    save();
    pintarRep();
    const again = $("repPal").querySelector('[data-pal="' + rep.r.pal + '"]');
    if (again) again.focus();
  });
  $("repGuardar").onclick = () => {
    rep.r.at = new Date().toISOString();
    rep.r.title = (rep.r.title || "").trim() || "Sin título";
    state.reports.unshift(rep.r);
    save();
    rep.saved = true;
    rep.info = true;
    pintarRep();
    toast(
      "Reporte guardado",
      () => {
        $("dlgRep").close();
        openReps();
      },
      "Ver reportes",
    );
  };
  $("repInfoBtn").onclick = () => {
    rep.info = !rep.info;
    pintarRep();
  };
  $("repBorrar").onclick = () =>
    arm($("repBorrar"), "Eliminar reporte", () => {
      state.reports = state.reports.filter((x) => x.id !== rep.r.id);
      save();
      $("dlgRep").close();
      openReps();
    });
  function openReps() {
    $("repsLista").innerHTML = state.reports.length
      ? state.reports
          .map((r) => {
            const f = fechaTxt(r.at);
            return (
              '<button type="button" class="repcard" data-rep="' +
              r.id +
              '"><i style="background:' +
              palDe(r.pal)[2] +
              '"></i><span><b>' +
              esc(r.title) +
              "</b><small>" +
              esc(f.dia + " " + f.fecha + " · " + f.hora) +
              "</small><small>" +
              esc(r.bookName + " › " + r.tableName + " · " + r.data.n + " filas") +
              "</small></span></button>"
            );
          })
          .join("")
      : '<div class="vacio">Aún no hay reportes guardados. Abre una tabla, toca el icono de reporte que está arriba y elige Guardar reporte.</div>';
    $("dlgReps").showModal();
  }
  $("repsLista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rep]");
    if (!b) return;
    const r = state.reports.find((x) => x.id === b.dataset.rep);
    if (!r) return;
    rep = { saved: true, info: true, r };
    disarm($("repBorrar"), "Eliminar reporte");
    $("dlgReps").close();
    syncHoja();
    pintarRep();
    $("dlgRep").showModal();
  });

  /* ---------- funciones que dependen de la forma del libro ----------
     "Generar mes" e "Importar nota" no pertenecen a un libro en particular: aparecen en cualquier libro que
     tenga las tablas y columnas necesarias. Cada pieza se busca por su nombre, sin importar mayúsculas ni
     acentos, así que funcionan igual en un libro restaurado, importado o creado a mano. */
  const norm = (s) =>
    String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();
  /* Primera columna de la tabla que se llame como alguno de los nombres y sea de uno de los tipos. */
  function colDe(t, nombres, tipos) {
    for (const n of nombres) {
      const c = t.cols.find((x) => norm(x.name) === n && (!tipos || tipos.includes(x.type)));
      if (c) return c;
    }
    return null;
  }
  const tablaDe = (nombre) => state.tables.find((t) => norm(t.name) === nombre);
  const TXT = ["text", "select"];
  /* Escribe un valor en la celda según el tipo de la columna; si es de selección, agrega la opción que falte. */
  function pon(c, col, v) {
    if (!col || v == null || v === "") return;
    if (col.type === "number") {
      const x = Number(v);
      c[col.id] = Number.isFinite(x) ? x : 0;
      return;
    }
    v = String(v).trim();
    if (col.type === "select") {
      col.options = col.options || [];
      if (!col.options.includes(v)) col.options.push(v);
    }
    c[col.id] = v;
  }

  /* ---------- generar mes ----------
     Necesita una tabla con una columna de texto "Periodo" y una relación hacia otra tabla que tenga la
     columna "Recurrencia". Opcionales: "Mes de pago" en esa otra tabla y "Estatus" en la primera. */
  function piezasGen() {
    for (const P of state.tables) {
      const per = colDe(P, ["periodo"], ["text"]);
      if (!per) continue;
      const rels = P.cols.filter((c) => c.type === "relation" && c.table !== P.id);
      rels.sort((a, b) => (norm(b.name) === "concepto") - (norm(a.name) === "concepto"));
      for (const rel of rels) {
        const C = tableById(rel.table),
          rec = C && colDe(C, ["recurrencia"], TXT);
        if (rec)
          return {
            P,
            C,
            per,
            rel,
            rec,
            mes: colDe(C, ["mes de pago", "mes"], TXT),
            est: colDe(P, ["estatus", "estado"], TXT),
          };
      }
    }
    return null;
  }
  function planGen(per, g) {
    const mes = MESES[+per.slice(5) - 1],
      ya = new Set(g.P.rows.filter((r) => r.c[g.per.id] === per).map((r) => r.c[g.rel.id]));
    const o = { nuevos: [], ya: 0, sinMes: 0, rec: 0, anu: 0, mes };
    g.C.rows.forEach((r) => {
      const rec = norm(r.c[g.rec.id]) || "mensual",
        suMes = g.mes ? norm(r.c[g.mes.id]) : "";
      if (rec === "unico") return;
      if (rec === "anual") {
        if (!suMes) {
          o.sinMes++;
          return;
        }
        if (suMes !== norm(mes)) return;
      }
      if (ya.has(r.id)) {
        o.ya++;
        return;
      }
      o.nuevos.push(r.id);
      if (rec === "anual") o.anu++;
      else o.rec++;
    });
    return o;
  }
  function infoGen() {
    const per = $("genMes").value,
      g = piezasGen();
    $("genError").textContent = "";
    if (!g) return null;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(per)) {
      $("genInfo").textContent = "Escribe el periodo como AAAA-MM, por ejemplo 2026-12.";
      return null;
    }
    const o = planGen(per, g),
      n = o.nuevos.length;
    $("genInfo").textContent =
      (n === 1 ? "Se creará 1 fila" : "Se crearán " + n + " filas") +
      " en " +
      g.P.name +
      (g.est ? ", en Pendiente" : "") +
      ": " +
      o.rec +
      (o.rec === 1 ? " recurrente y " : " recurrentes y ") +
      o.anu +
      (o.anu === 1 ? " anual de " : " anuales de ") +
      o.mes.toLowerCase() +
      "." +
      (o.ya
        ? " " + o.ya + (o.ya === 1 ? " ya existe y no se duplica." : " ya existen y no se duplican.")
        : "") +
      (o.sinMes
        ? " " +
          o.sinMes +
          (o.sinMes === 1 ? " anual sin mes de pago queda fuera." : " anuales sin mes de pago quedan fuera.")
        : "");
    o.g = g;
    return o;
  }
  $("btnGen").onclick = () => {
    const g = piezasGen();
    if (!g) return;
    const ps = g.P.rows
        .map((r) => r.c[g.per.id])
        .filter((x) => /^\d{4}-\d{2}$/.test(x || ""))
        .sort(),
      d = new Date();
    let y = d.getFullYear(),
      m = d.getMonth() + 1;
    if (ps.length) {
      y = +ps[ps.length - 1].slice(0, 4);
      m = +ps[ps.length - 1].slice(5) + 1;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    $("genTitulo").textContent = "Generar " + g.P.name.toLowerCase() + " del mes";
    $("genAyuda").textContent =
      "Toma las filas de la tabla " +
      g.C.name +
      " según su " +
      g.rec.name +
      ": las recurrentes siempre, las anuales solo en su mes" +
      (g.mes ? " (columna " + g.mes.name + ")" : "") +
      " y las únicas nunca.";
    $("genMes").value = y + "-" + String(m).padStart(2, "0");
    infoGen();
    $("dlgGen").showModal();
  };
  $("genMes").addEventListener("input", infoGen);
  $("formGen").addEventListener("submit", (e) => {
    e.preventDefault();
    const o = infoGen();
    if (!o) return;
    if (!o.nuevos.length) {
      $("genError").textContent = "No hay filas por crear en ese periodo.";
      return;
    }
    const per = $("genMes").value,
      g = o.g;
    snap();
    if (g.est && g.est.type === "select") {
      g.est.options = g.est.options || [];
      if (!g.est.options.includes("Pendiente")) g.est.options.unshift("Pendiente");
    }
    g.P.rows.unshift(
      ...o.nuevos.map((id) => {
        const c = {};
        c[g.rel.id] = id;
        c[g.per.id] = per;
        if (g.est) c[g.est.id] = "Pendiente";
        return { id: "r_" + uid(), c };
      }),
    );
    dirty();
    $("dlgGen").close();
    goTab(g.P.id);
    ui.f = { col: g.per.id, op: "eq", val: per };
    $("fOp").value = "eq";
    $("fVal").value = per;
    $("filtro").hidden = false;
    $("btnFiltro").setAttribute("aria-expanded", "true");
    render();
    toast(
      (o.nuevos.length === 1 ? "Se creó 1 fila de " : "Se crearon " + o.nuevos.length + " filas de ") + per,
      undoApp,
    );
  });

  /* ---------- libros ---------- */
  function irLibro(id) {
    state.cur = id;
    idx.clear();
    agg.clear();
    undoS.length = 0;
    redoS.length = 0;
    botones();
    save();
    goTab(state.tables[0] && state.tables[0].id);
  }
  const ICO = {
    home: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M4 11l8-7 8 7v9H4z" fill="none"/><path d="M10 20v-6h4v6" fill="none"/></svg>',
    rep: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" fill="none"/><path d="M9.5 17v-3M12.5 17v-6M15.5 17v-4" fill="none"/></svg>',
    room: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" fill="none"/><path d="M9.5 12h6M9.5 16h6" fill="none"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1" fill="none"/><path d="M3 10h18M3 14.5h18M10 5v14" fill="none"/></svg>',
  };
  function findNode(id, nodes) {
    for (const n of nodes || state.tree) {
      if (n.id === id) return n;
      if (n.children) {
        const r = findNode(id, n.children);
        if (r) return r;
      }
    }
    return null;
  }
  function prune(nodes, bid) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.kind === "book") {
        if (n.book === bid) nodes.splice(i, 1);
      } else prune(n.children, bid);
    }
  }
  function navList(nodes, d) {
    return (
      '<ul role="list">' +
      nodes
        .map((n) => {
          if (n.kind === "book") {
            const b = state.books.find((x) => x.id === n.book);
            if (!b) return "";
            return (
              '<li><div class="nrow" style="--d:' +
              d +
              '"><button type="button" class="nbtn" data-book="' +
              b.id +
              '"' +
              (b.id === book().id && ui.vista === "libro" ? ' aria-current="page"' : "") +
              '><span class="nch"></span>' +
              ICO.book +
              '<span class="ntx">' +
              esc(b.name) +
              '</span></button><button type="button" class="nadd" data-node="b:' +
              b.id +
              '" aria-label="Opciones del libro ' +
              esc(b.name) +
              '">⋯</button></div></li>'
            );
          }
          return (
            '<li><div class="nrow" style="--d:' +
            d +
            '"><button type="button" class="nbtn" data-room="' +
            n.id +
            '" aria-expanded="' +
            !!n.open +
            '"><span class="nch" aria-hidden="true">' +
            (n.open ? "▾" : "▸") +
            "</span>" +
            ICO.room +
            '<span class="ntx">' +
            esc(n.name) +
            '</span></button><button type="button" class="nadd" data-node="r:' +
            n.id +
            '" aria-label="Opciones de la sala ' +
            esc(n.name) +
            '">⋯</button></div>' +
            (n.open ? navList(n.children, d + 1) : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }
  function renderNav() {
    $("nav").innerHTML =
      '<div class="nrow" style="--d:0;margin-top:12px"><button type="button" class="nbtn" data-inicio' +
      (ui.vista === "inicio" ? ' aria-current="page"' : "") +
      ">" +
      ICO.home +
      '<span class="ntx">Inicio</span></button></div>' +
      '<div class="nrow" style="--d:0"><button type="button" class="nbtn" data-reps>' +
      ICO.rep +
      '<span class="ntx">Reportes guardados</span><span class="vac" style="margin-left:auto;font-family:var(--mono);font-size:13px">' +
      state.reports.length +
      "</span></button></div>" +
      state.tree
        .map(
          (sec) =>
            '<section aria-label="' +
            esc(sec.name) +
            '"><div class="nsec"><button type="button" class="nbtn" data-room="' +
            sec.id +
            '" aria-expanded="' +
            !!sec.open +
            '"><span class="ntx">' +
            esc(sec.name) +
            '</span><span class="nch" aria-hidden="true">' +
            (sec.open ? "▾" : "▸") +
            '</span></button><button type="button" class="nadd" data-node="r:' +
            sec.id +
            '" aria-label="Opciones de la sección ' +
            esc(sec.name) +
            '">⋯</button></div>' +
            (sec.open ? navList(sec.children, 0) : "") +
            "</section>",
        )
        .join("");
  }
  $("btnNav").onclick = () => {
    renderNav();
    $("dlgNav").showModal();
  };
  $("nav").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if ("reps" in b.dataset) {
      $("dlgNav").close();
      openReps();
      return;
    }
    if (b.dataset.book) {
      $("dlgNav").close();
      if (b.dataset.book !== book().id) irLibro(b.dataset.book);
      mostrar("libro");
    } else if ("inicio" in b.dataset) {
      $("dlgNav").close();
      mostrar("inicio");
    } else if (b.dataset.room) {
      const n = findNode(b.dataset.room);
      n.open = !n.open;
      save();
      renderNav();
      const again = $("nav").querySelector('[data-room="' + n.id + '"]');
      if (again) again.focus();
    } else if (b.dataset.node) openNodo(b.dataset.node);
  });
  document.addEventListener("click", (e) => {
    const d = e.target;
    if (!(d.matches && d.matches("dialog.drawer"))) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  });
  $("ajLibroOk").onclick = () => {
    const n = $("ajLibro").value.trim();
    if (n) {
      book().name = n;
      save();
      render();
    }
  };
  $("ajLibroDel").onclick = () =>
    arm($("ajLibroDel"), "Eliminar libro", () => {
      if (state.books.length < 2) return;
      const id = book().id;
      state.books = state.books.filter((b) => b.id !== id);
      prune(state.tree, id);
      $("dlgAjustes").close();
      irLibro(state.books[0].id);
    });

  /* ---------- nota de servicio (bloque JSON que entrega Claude) ----------
     Necesita la tabla "Servicios" con una columna de texto "ID" (o "Folio"), y las tablas "Mano de obra" y
     "Refacciones", cada una con una relación hacia Servicios y una columna numérica "Importe".
     Las demás columnas son opcionales: si no existen, ese dato de la nota no se guarda. */
  function piezasNota() {
    const S = tablaDe("servicios"),
      id = S && colDe(S, ["id", "folio"], ["text"]);
    if (!id) return null;
    const hija = (nombre) => {
      const t = tablaDe(nombre),
        rel = t && t.cols.find((c) => c.type === "relation" && c.table === S.id),
        imp = t && colDe(t, ["importe"], ["number"]);
      return rel && imp ? { t, rel, imp } : null;
    };
    const M = hija("mano de obra"),
      R = hija("refacciones");
    return M && R ? { S, id, M, R } : null;
  }
  function importarNota(txt) {
    const g = piezasNota();
    if (!g) return "Este libro ya no tiene las tablas que necesita la nota.";
    let d;
    try {
      d = JSON.parse(txt.replace(/^\s*```\w*\s*$/gm, "").trim());
    } catch (e) {
      return "No se pudo leer. Copia el bloque completo, desde la primera llave hasta la última.";
    }
    const notas = Array.isArray(d) ? d : [d],
      S = g.S,
      vistos = new Set(S.rows.map((r) => norm(r.c[g.id.id])));
    for (const n of notas) {
      if (!n || !n.servicio || !n.servicio.id) return 'Falta el dato "servicio.id".';
      const k = norm(n.servicio.id);
      if (vistos.has(k)) return "Ya existe " + n.servicio.id + " en " + S.name + ".";
      vistos.add(k);
    }
    snap();
    /* Relación con otra tabla: usa la fila que ya se llame así o la crea. */
    const liga = (c, col, nombre) => {
      const t = col && tableById(col.table),
        c0 = t && t.cols[0];
      if (!c0 || !["text", "select"].includes(c0.type) || nombre == null || nombre === "") return;
      const k = norm(nombre);
      let r = t.rows.find((x) => norm(x.c[c0.id]) === k);
      if (!r) {
        r = { id: "r_" + uid(), c: {} };
        pon(r.c, c0, nombre);
        t.rows.push(r);
      }
      c[col.id] = r.id;
    };
    const col = (t, nombres, tipos) => colDe(t, nombres, tipos || TXT);
    const cS = {
        fec: col(S, ["fecha"], ["date", "text"]),
        veh: col(S, ["vehiculo"], ["relation"]),
        tal: col(S, ["taller"], ["relation"]),
        tip: col(S, ["tipo"]),
        des: col(S, ["descripcion"]),
        est: col(S, ["estatus de pago", "estatus", "estado"]),
        km: col(S, ["km al servicio", "km", "kilometraje"], ["number"]),
        not: col(S, ["nota", "notas"]),
      },
      M = g.M,
      R = g.R,
      mCon = col(M.t, ["concepto"]),
      rNom = col(R.t, ["refaccion"]),
      rCan = col(R.t, ["cantidad"], ["number"]),
      rDet = col(R.t, ["detalle original", "detalle"]);
    notas.forEach((n) => {
      const s = n.servicio,
        id = "r_" + uid(),
        c = {};
      pon(c, g.id, s.id);
      pon(c, cS.fec, s.fecha);
      liga(c, cS.veh, s.vehiculo);
      liga(c, cS.tal, s.taller);
      pon(c, cS.tip, s.tipo);
      pon(c, cS.des, s.descripcion);
      pon(c, cS.est, s.estatus);
      pon(c, cS.km, s.km);
      pon(c, cS.not, s.nota);
      S.rows.unshift({ id, c });
      (n.mano_de_obra || []).forEach((x) => {
        const c2 = {};
        c2[M.rel.id] = id;
        pon(c2, mCon, x.concepto || "Mano de obra");
        pon(c2, M.imp, x.importe || 0);
        M.t.rows.unshift({ id: "r_" + uid(), c: c2 });
      });
      (n.refacciones || []).forEach((x) => {
        const c2 = {};
        c2[R.rel.id] = id;
        pon(c2, rNom, x.refaccion);
        pon(c2, R.imp, x.importe || 0);
        pon(c2, rCan, x.cantidad);
        pon(c2, rDet, x.detalle);
        R.t.rows.unshift({ id: "r_" + uid(), c: c2 });
      });
    });
    dirty();
    return "";
  }
  $("btnNota").onclick = () => {
    $("notaTexto").value = "";
    $("notaError").textContent = "";
    $("dlgNota").showModal();
  };
  $("formNota").addEventListener("submit", (e) => {
    e.preventDefault();
    const g = piezasNota(),
      er = importarNota($("notaTexto").value);
    if (er) {
      $("notaError").textContent = er;
      return;
    }
    $("dlgNota").close();
    goTab(g.S.id);
    toast("Nota agregada a " + g.S.name, undoApp);
  });

  $("btnUndo").onclick = undoApp;
  $("btnRedo").onclick = redoApp;
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k !== "z" && k !== "y") return;
    if (document.querySelector("dialog[open]") || ui.vista !== "libro") return;
    const a = e.target;
    if (a.matches && a.matches("input,textarea")) {
      if (!a.dataset.cell) return;
      const t = cur(),
        r = t && rowIndex(t).get(a.closest("tr").dataset.id),
        st = r && r.c[a.dataset.cell];
      if (a.value !== String(st == null ? "" : st)) return; /* a medio escribir: deshace el navegador */
    }
    e.preventDefault();
    if (k === "y" || e.shiftKey) redoApp();
    else undoApp();
  });

  $("prImprimir").onclick = () => imprimir($("prHoja"));
  $("repImprimir").onclick = () => imprimir($("repHoja"));
  /* ---------- página de inicio ---------- */
  function titulo() {
    $("libroNom").textContent = ui.vista === "inicio" ? "Bases unificadas" : book().name;
  }
  function renderInicio() {
    const b = book();
    $("iniSeguir").textContent = "Abrir " + b.name;
    $("iniLibros").innerHTML = state.books
      .map((x) => {
        let f = 0;
        x.tables.forEach((t) => {
          f += t.rows.length;
        });
        const ruta = (rutaLibro(x.id) || []).join(" › "),
          n = x.tables.length;
        return (
          '<li><button type="button" class="ini-item" data-book="' +
          x.id +
          '">' +
          ICO.book +
          '<span class="ini-txt"><b>' +
          esc(x.name) +
          "</b><small>" +
          esc(
            (ruta ? ruta + " · " : "") +
              n +
              (n === 1 ? " tabla · " : " tablas · ") +
              f +
              (f === 1 ? " fila" : " filas"),
          ) +
          "</small></span>" +
          (x.id === b.id ? '<span class="pill">Último abierto</span>' : "") +
          "</button></li>"
        );
      })
      .join("");
    $("iniReps").innerHTML = state.reports.length
      ? state.reports
          .slice(0, 3)
          .map((r) => {
            const f = fechaTxt(r.at);
            return (
              '<li><button type="button" class="ini-item" data-rep="' +
              r.id +
              '">' +
              ICO.rep +
              '<span class="ini-txt"><b>' +
              esc(r.title) +
              "</b><small>" +
              esc(f.fecha + " · " + r.bookName + " › " + r.tableName) +
              "</small></span></button></li>"
            );
          })
          .join("")
      : '<li><p class="ini-vacio">Aún no hay reportes guardados. Abre una tabla, toca el icono de reporte que está arriba y elige Guardar reporte.</p></li>';
    $("iniRepsVer").hidden = state.reports.length < 4;
    $("iniBakInfo").textContent =
      "Tus datos se guardan solo en este navegador. " +
      (state.prefs.bak
        ? "Último respaldo: " +
          new Date(state.prefs.bak).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) +
          "."
        : "Aún no has creado un respaldo.");
    $("iniDocs").hidden = !NATIVO;
  }
  /* Cambia entre la página de inicio y el libro. El botón Atrás del navegador regresa a la vista anterior. */
  function mostrar(v, sinHistorial) {
    ui.vista = v;
    const ini = v === "inicio";
    $("vistaInicio").hidden = !ini;
    $("vistaLibro").hidden = ini;
    ["btnUndo", "btnRedo", "btnRep"].forEach((x) => {
      $(x).hidden = ini;
    });
    titulo();
    renderNav();
    if (ini) renderInicio();
    if (!sinHistorial)
      try {
        if ((history.state && history.state.v) !== v) history.pushState({ v }, "");
      } catch (e) {}
    window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", (e) =>
    mostrar(e.state && e.state.v === "libro" ? "libro" : "inicio", true),
  );
  $("iniSeguir").onclick = () => mostrar("libro");
  $("iniLibros").addEventListener("click", (e) => {
    const b = e.target.closest("[data-book]");
    if (!b) return;
    if (b.dataset.book !== book().id) irLibro(b.dataset.book);
    mostrar("libro");
  });
  $("iniNuevo").onclick = () => {
    let k = 1;
    while (state.books.some((x) => x.name === "Libro " + k)) k++;
    const id = "b_" + uid();
    state.books.push({ id, name: "Libro " + k, tables: [] });
    state.tree[0].children.push({ kind: "book", book: id });
    state.tree[0].open = true;
    irLibro(id);
    mostrar("libro");
  };
  $("iniReps").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rep]"),
      r = b && state.reports.find((x) => x.id === b.dataset.rep);
    if (!r) return;
    rep = { saved: true, info: true, r };
    disarm($("repBorrar"), "Eliminar reporte");
    syncHoja();
    pintarRep();
    $("dlgRep").showModal();
  });
  $("iniRepsVer").onclick = openReps;
  $("iniBak").onclick = $("avisoBak").onclick = () => $("ajBak").click();
  $("iniRes").onclick = () => $("ajRes").click();
  /* Al cerrar cualquier diálogo, el inicio se vuelve a pintar con lo que haya cambiado. */
  document.querySelectorAll("dialog").forEach((d) =>
    d.addEventListener("close", () => {
      if (ui.vista === "inicio") renderInicio();
    }),
  );

  completarArbol();
  if (migrar) escribirBD(JSON.stringify(state));
  conDescargas();
  applyPrefs();
  goTab(ui.tab);
  try {
    history.replaceState({ v: "inicio" }, "");
  } catch (e) {}
  mostrar("inicio", true);
})();
