/* Prueba de los flujos principales en un navegador a ancho de celular.
   Uso: node pruebas/flujo.js   (necesita Playwright con Chromium instalado)
   Solo usa las tablas de ejemplo; no lee ni escribe datos reales. */
const { chromium } = require("playwright");
const path = require("path");
const URL_APP = "file://" + path.resolve(__dirname, "..", "index.html");

let fallas = 0;
function comprobar(nombre, ok, detalle) {
  if (!ok) fallas++;
  console.log((ok ? "  bien   " : "  FALLA  ") + nombre + (ok || detalle === undefined ? "" : " → " + JSON.stringify(detalle)));
}

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 375, height: 740 } });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", (e) => errores.push(e.message));
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const chicos = () =>
    p.evaluate(() =>
      [...document.querySelectorAll("button, a.btn")]
        .filter((b) => b.offsetParent && !b.closest("dialog:not([open])"))
        .map((b) => {
          const r = b.getBoundingClientRect();
          return [b.getAttribute("aria-label") || b.textContent.trim().slice(0, 24), Math.round(r.width), Math.round(r.height)];
        })
        .filter((x) => x[1] < 40 || x[2] < 40),
    );

  console.log("Inicio");
  await p.goto(URL_APP);
  comprobar("abre en la página de inicio", await p.locator("#vistaInicio").isVisible());
  comprobar("el libro queda oculto", await p.locator("#vistaLibro").isHidden());
  comprobar("lista el libro de ejemplo", (await p.locator("#iniLibros .ini-item").count()) === 1);
  comprobar("no se desplaza a los lados", (await ancho()) <= 0, await ancho());
  comprobar("botones de 40 px o más", (await chicos()).length === 0, await chicos());

  console.log("Libro");
  await p.click("#iniSeguir");
  comprobar("abre el libro", await p.locator("#grid tbody tr").first().isVisible());
  comprobar("muestra las 6 ventas", (await p.locator("#grid tbody tr").count()) === 6);
  comprobar("no se desplaza a los lados", (await ancho()) <= 0, await ancho());
  comprobar("botones de 40 px o más", (await chicos()).length === 0, await chicos());
  await p.goBack();
  comprobar("Atrás regresa al inicio", await p.locator("#vistaInicio").isVisible());
  await p.click("#btnNav");
  comprobar("la barra lateral tiene Inicio", await p.locator("#nav [data-inicio]").isVisible());
  comprobar("botones de 44 px en la barra lateral", await p.evaluate(() => [...document.querySelectorAll("#nav button")].every((b) => b.getBoundingClientRect().height >= 44)));
  await p.click('#nav [data-book="b_ej"]');
  comprobar("la barra lateral abre el libro", await p.locator("#vistaLibro").isVisible());

  console.log("Guardado");
  const folio = () => p.locator("#grid tbody tr").first().locator('input[data-cell="v_fol"]');
  await folio().fill("CAMBIO");
  await folio().dispatchEvent("change");
  await p.reload();
  await p.click("#iniSeguir");
  comprobar("un cambio sobrevive a recargar enseguida", (await folio().inputValue()) === "CAMBIO", await folio().inputValue());

  console.log("Vistas guardadas");
  const conteo = () => p.locator("#conteo").textContent();
  const marcada = (sel) => p.locator("#vistas " + sel).getAttribute("aria-pressed");
  comprobar("empieza en Todas las filas", (await marcada("[data-todas]")) === "true");
  await p.click("#vistas [data-guardar]");
  comprobar("no deja guardar una vista vacía", await p.locator("#visOk").isDisabled());
  await p.click("#dlgVista [data-close]");
  await p.fill("#buscar", "puebla");
  await p.click('#grid [data-sort="v_can"]');
  await p.click("#vistas [data-guardar]");
  await p.fill("#visNombre", "Puebla");
  await p.click("#visOk");
  comprobar("guarda la vista y la marca", (await marcada("[data-vista]")) === "true" && (await conteo()) === "2 de 6 filas", await conteo());
  await p.click("#vistas [data-todas]");
  comprobar("Todas las filas quita la búsqueda", (await conteo()) === "6 filas" && (await p.inputValue("#buscar")) === "", await conteo());
  await p.reload();
  await p.click("#iniSeguir");
  await p.click("#vistas [data-vista]");
  comprobar("la vista sigue ahí al recargar y se aplica", (await conteo()) === "2 de 6 filas" && (await p.inputValue("#buscar")) === "puebla", await conteo());
  comprobar("aplica también su orden", (await p.locator('#grid th[aria-sort="ascending"]').textContent()).includes("Cantidad"));
  comprobar("la fila de vistas no ensancha la página", (await ancho()) <= 0, await ancho());
  comprobar("botones de 40 px o más", (await chicos()).length === 0, await chicos());
  await p.click("#vistas [data-editar]");
  await p.fill("#visNombre", "Solo Puebla");
  await p.click("#visOk");
  comprobar("se puede renombrar", (await p.locator("#vistas [data-vista]").textContent()).includes("Solo Puebla"));
  await p.click("#vistas [data-editar]");
  await p.click("#visBorrar");
  comprobar("se puede eliminar", (await p.locator("#vistas [data-vista]").count()) === 0);
  await p.click("#toastBtn");
  comprobar("y la eliminación se deshace", (await p.locator("#vistas [data-vista]").count()) === 1);
  await p.click('#grid [data-sort="v_can"]');
  await p.click('#grid [data-sort="v_can"]');
  await p.click("#vistas [data-todas]");

  console.log("Menú de columna y totales al pie");
  const celdasCol = (cls) => p.locator('#grid tbody td[data-c="v_can"]' + cls).count();
  const pie = (col) => p.evaluate((i) => { const td = document.querySelectorAll("#grid tfoot td")[i]; return td ? td.textContent : null; }, col);
  comprobar("sin totales no hay pie", (await p.locator("#grid tfoot tr").count()) === 0);
  await p.click('#grid [data-col="v_can"]');
  comprobar("el botón de la columna abre su menú", (await p.locator("#cmT").textContent()) === "Columna Cantidad");
  comprobar("selecciona toda la columna", (await p.locator("#grid .colsel").count()) === 7);
  comprobar("el menú no ofrece tamaño de letra", !/tamaño|letra/i.test(await p.locator("#dlgColMenu").textContent()));
  comprobar("botones de 40 px o más", (await chicos()).length === 0, await chicos());
  await p.click("#cmB");
  await p.click("#cmH");
  comprobar("negritas y resaltado en toda la columna", (await celdasCol(".bd.hl")) === 6 && (await p.locator("#cmB").getAttribute("aria-pressed")) === "true");
  await p.click("#cmClear");
  comprobar("Quitar formato la deja limpia", (await celdasCol(".bd")) === 0 && (await celdasCol(".hl")) === 0);
  await p.check('#dlgColMenu input[value="sum"]');
  await p.click("#dlgColMenu [data-close]");
  await p.waitForTimeout(100);
  comprobar("al cerrar se quita la selección", (await p.locator("#grid .colsel").count()) === 0);
  comprobar("suma de Cantidad", (await pie(4)) === "Suma53", await pie(4));
  await p.fill("#buscar", "puebla");
  await p.waitForTimeout(250);
  comprobar("el total respeta la búsqueda", (await pie(4)) === "Suma10", await pie(4));
  await p.fill("#buscar", "");
  await p.waitForTimeout(250);
  const cant = p.locator("#grid tbody tr").first().locator('input[data-cell="v_can"]');
  const antes = await cant.inputValue();
  await cant.fill("100");
  await cant.blur();
  comprobar("el total cambia al editar una celda", (await pie(4)) === "Suma" + (53 - Number(antes) + 100), await pie(4));
  await p.click("#btnUndo");
  await p.click('#grid [data-col="v_can"]');
  await p.check('#dlgColMenu input[value="avg"]');
  await p.click("#dlgColMenu [data-close]");
  comprobar("promedio de Cantidad", (await pie(4)) === "Promedio8.83", await pie(4));
  await p.click('#grid [data-col="v_fol"]');
  comprobar("una columna de texto solo ofrece conteo", (await p.locator('#dlgColMenu input[value="sum"]').isHidden()) && (await p.locator('#dlgColMenu input[value="count"] + span').isVisible()));
  await p.check('#dlgColMenu input[value="count"]');
  await p.click("#dlgColMenu [data-close]");
  comprobar("conteo de Folio", (await pie(0)) === "Conteo6", await pie(0));
  comprobar("el pie no ensancha la página", (await ancho()) <= 0, await ancho());
  await p.click("#btnAjustes");
  await p.click("#ajPrint");
  comprobar("la vista de impresión lleva los totales", (await p.locator("#prTabla tfoot td").count()) === 7 && (await p.locator("#prTabla tfoot").textContent()).includes("Promedio8.83"));
  await p.click("#dlgPrint [data-close]");
  await p.reload();
  await p.click("#iniSeguir");
  comprobar("los totales siguen al recargar", (await pie(0)) === "Conteo6" && (await pie(4)) === "Promedio8.83");
  for (const c of ["v_can", "v_fol"]) {
    await p.click('#grid [data-col="' + c + '"]');
    await p.check('#dlgColMenu input[value=""]');
    await p.click("#dlgColMenu [data-close]");
  }

  console.log("Reportes completos");
  await p.evaluate(() => (window.print = () => (window.__impreso = (window.__impreso || 0) + 1)));
  await p.click("#btnRep");
  await p.selectOption("#repG", "v_cli");
  await p.selectOption("#repG2", "v_ciu");
  comprobar("dos desgloses en el título de la sección", (await p.locator("#repHoja h3").first().textContent()) === "Por Cliente y Ciudad");
  comprobar("cada grupo lleva su segundo desglose", (await p.locator("#repHoja .rp-grp").count()) === 4 && (await p.locator("#repHoja .rp-grp span.sub:not(.n)").count()) === 4);
  comprobar("el detalle termina con el total", (await p.locator("#repHoja tfoot").textContent()) === "Suma53", await p.locator("#repHoja tfoot").textContent());
  comprobar("el reporte no ensancha la página", (await ancho()) <= 0, await ancho());
  comprobar("botones de 40 px o más", (await chicos()).length === 0, await chicos());
  await p.fill("#repTitulo", "Ventas por cliente");
  await p.click("#repPlGuardar");
  comprobar("guarda la plantilla", (await p.locator("#repPlMsg").textContent()).includes("Plantilla guardada: Ventas por cliente"));
  await p.click("#dlgRep [data-close]");
  await p.click("#btnRep");
  comprobar("un reporte nuevo empieza sin segundo desglose", (await p.inputValue("#repG2")) === "");
  await p.selectOption("#repPl", { label: "Ventas por cliente" });
  comprobar("la plantilla arma el reporte igual", (await p.inputValue("#repG")) === "v_cli" && (await p.inputValue("#repG2")) === "v_ciu" && (await p.inputValue("#repTitulo")) === "Ventas por cliente");
  await p.click("#repPlBorrar");
  comprobar("eliminar la plantilla avisa encima del reporte", await p.locator("#dlgRep #toast").isVisible());
  await p.click("#toastBtn");
  comprobar("y se deshace", (await p.locator("#repPl option").count()) === 2);
  await p.check('#dlgRep input[name="hojaRep"][value="h"]');
  await p.click("#repImprimir");
  const hoja = await p.evaluate(() => ({ css: document.getElementById("hojaCss").textContent, corre: document.querySelectorAll("#printArea .rp-corre").length, veces: window.__impreso }));
  comprobar("imprime en carta horizontal con número de página", /size:letter landscape/.test(hoja.css) && /counter\(page\)/.test(hoja.css) && hoja.veces === 1, hoja);
  comprobar("la hoja lleva el título que se repite", hoja.corre === 1);
  await p.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await p.check('#dlgRep input[name="hojaRep"][value="v"]');
  await p.click("#repImprimir");
  comprobar("y en carta vertical", /size:letter portrait/.test(await p.evaluate(() => document.getElementById("hojaCss").textContent)));
  await p.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await p.click("#repPresentar");
  const dia = () => p.locator("#presN").textContent();
  comprobar("la presentación arma portada, cifras, desglose y una por grupo", (await dia()) === "1 de 7", await dia());
  comprobar("empieza en la portada", (await p.locator("#presSlide").getAttribute("aria-label")) === "Diapositiva 1 de 7: Portada" && (await p.locator("#presAnt").isDisabled()));
  await p.keyboard.press("ArrowRight");
  comprobar("la flecha avanza", (await dia()) === "2 de 7");
  await p.locator("#presSlide").click({ position: { x: 300, y: 60 } });
  comprobar("tocar la diapositiva avanza", (await dia()) === "3 de 7" && (await p.locator("#presSlide h3").textContent()).startsWith("Por Cliente"));
  await p.locator("#presSlide").click({ position: { x: 20, y: 60 } });
  comprobar("tocar su orilla izquierda regresa", (await dia()) === "2 de 7");
  await p.keyboard.press("End");
  comprobar("la última es el segundo desglose de un grupo", (await dia()) === "7 de 7" && (await p.locator("#presSlide").getAttribute("aria-label")).endsWith("por Ciudad") && (await p.locator("#presSig").isDisabled()));
  comprobar("nada se sale de la diapositiva", await p.evaluate(() => { const i = document.querySelector("#presSlide .pres-in"); return i.scrollHeight <= i.clientHeight + 1 && i.scrollWidth <= i.clientWidth + 1; }));
  comprobar("botones de 40 px o más", (await chicos()).length === 0, await chicos());
  await p.click("#presFS");
  await p.waitForTimeout(300);
  comprobar("pantalla completa", (await p.evaluate(() => document.fullscreenElement && document.fullscreenElement.id)) === "presCaja" && (await p.locator("#presFS").textContent()) === "Salir de pantalla completa");
  await p.click("#dlgPres [data-close]");
  await p.waitForTimeout(300);
  comprobar("al cerrar sale de pantalla completa y vuelve al reporte", (await p.evaluate(() => !document.fullscreenElement)) && (await p.locator("#dlgPres").isHidden()) && (await p.locator("#repHoja").isVisible()));
  await p.click("#repGuardar");
  comprobar("guardar el reporte avisa encima del reporte", await p.locator("#dlgRep #toast").isVisible());
  await p.click("#dlgRep [data-close]");

  console.log("Fórmulas");
  await p.click('#grid [data-col="v_tot"]');
  await p.click("#cmEditar");
  await p.fill("#colExpr", "{ cantidad } * {Precio}");
  await p.click("#formCol button[type=submit]");
  await p.click('#grid [data-col="v_can"]');
  await p.click("#cmEditar");
  await p.fill("#colNombre", "Piezas");
  await p.click("#formCol button[type=submit]");
  const total = await p.locator('#grid tbody tr').first().locator('[data-calc="v_tot"]').textContent();
  comprobar("renombrar una columna actualiza la fórmula", total === "1,020", total);

  console.log("Importar CSV");
  await p.click("#btnImport");
  await p.fill("#impNombre", "Prueba");
  await p.fill("#impTexto", 'Nombre,CP,Monto,Fecha,Piezas\nAna,01000,"$1,250.50",05/11/2026,3\nLuis,06700,-$300,6/1/2026,10');
  await p.click("#formImport button[type=submit]");
  const tipos = await p.locator("#grid thead .tipo").allTextContents();
  comprobar("tipos: texto, texto, número, fecha, número", tipos.join() === "texto,texto,número,fecha,número", tipos);
  const celdas = await p.locator("#grid tbody tr").first().locator("input").evaluateAll((a) => a.map((i) => i.value));
  comprobar("conserva ceros, convierte importe y fecha", celdas.join("|") === "Ana|01000|1250.5|2026-11-05|3", celdas);

  console.log("Opciones");
  await p.click("#btnCol");
  await p.fill("#colNombre", "Estado");
  await p.selectOption("#colTipo", "select");
  await p.fill("#colOpts", "Pagado\nPendiente");
  await p.click("#formCol button[type=submit]");
  await p.locator("#grid tbody tr").first().locator("[data-opt]").click();
  await p.locator("#optLista button", { hasText: "Pagado" }).click();
  await p.locator("#grid thead .cfg").last().click();
  await p.click("#cmEditar");
  await p.fill("#colOpts", "Pendiente");
  await p.click("#formCol button[type=submit]");
  await p.locator("#grid tbody tr").first().locator("[data-opt]").click();
  comprobar("la opción quitada sigue visible para poder cambiarla", (await p.locator("#optLista").textContent()).includes("ya no está en la lista"));
  await p.click("#dlgOpt [data-close]");

  console.log("Respaldo");
  const propio = await p.evaluate(() => {
    document.getElementById("btnAjustes").click();
    document.getElementById("ajBak").click();
    document.getElementById("bakCopiar").click();
    return new Promise((r) => setTimeout(() => r(document.getElementById("bakTexto").value), 200));
  });
  await p.click("#dlgBak [data-close]");
  const restaurar = async (texto) => {
    await p.click("#btnAjustes");
    await p.click("#ajRes");
    await p.fill("#resTexto", texto);
  };
  await p.evaluate(() => (window.__x = 0));
  const malo = JSON.stringify({ app: "bases-unificadas", formato: 1, creado: new Date().toISOString(), state: { books: [{ id: "b1", name: "L", tables: [{ id: 't1"><img src=x onerror="window.__x=1', name: "T", cols: [{ id: "c1", name: "N", type: "text" }], rows: [] }] }], cur: "b1" } });
  await restaurar(malo);
  comprobar("rechaza un respaldo manipulado", (await p.locator("#resOk").isDisabled()) && (await p.locator("#resError").textContent()).includes("dañado"));
  comprobar("el respaldo manipulado no ejecuta nada", (await p.evaluate(() => window.__x)) === 0);
  await p.click("#dlgRes [data-close]");
  if (propio) {
    await restaurar(propio);
    await p.click("#resOk");
    await p.click("#resOk");
    comprobar("restaura un respaldo propio", (await p.locator("#tabs .tab", { hasText: "Prueba" }).count()) === 1);
  } else comprobar("restaura un respaldo propio", false, "no se pudo leer el texto del respaldo");

  console.log("Generar mes e Importar nota (libro inventado, sin identificadores fijos)");
  const fila = (id, c) => ({ id, c });
  const inventado = JSON.stringify({
    app: "bases-unificadas",
    formato: 1,
    creado: new Date().toISOString(),
    state: {
      cur: "bx",
      books: [
        {
          id: "bx",
          name: "Inventado",
          tables: [
            {
              id: "ta",
              name: "Cuotas",
              cols: [
                { id: "a1", name: "Concepto", type: "relation", table: "tb" },
                { id: "a2", name: "PERIODO", type: "text" },
                { id: "a3", name: "Estatus", type: "select", options: ["Pagado"] },
              ],
              rows: [fila("ra1", { a1: "rb1", a2: "2030-01", a3: "Pagado" })],
            },
            {
              id: "tb",
              name: "Conceptos",
              cols: [
                { id: "b1", name: "Concepto", type: "text" },
                { id: "b2", name: "recurrencia", type: "select", options: ["Mensual", "Anual", "Único"] },
                { id: "b3", name: "Mes de pago", type: "select", options: ["Febrero", "Marzo"] },
              ],
              rows: [
                fila("rb1", { b1: "Renta", b2: "Mensual" }),
                fila("rb2", { b1: "Luz" }),
                fila("rb3", { b1: "Seguro", b2: "Anual", b3: "Febrero" }),
                fila("rb4", { b1: "Predial", b2: "Anual", b3: "Marzo" }),
                fila("rb5", { b1: "Tenencia", b2: "Anual" }),
                fila("rb6", { b1: "Mudanza", b2: "Único" }),
              ],
            },
            {
              id: "tc",
              name: "Servicios",
              cols: [
                { id: "c1", name: "Folio", type: "text" },
                { id: "c2", name: "Fecha", type: "date" },
                { id: "c3", name: "Vehículo", type: "relation", table: "tf" },
                { id: "c4", name: "Tipo", type: "select", options: ["Reparación"] },
                { id: "c5", name: "Mano de obra", type: "sum", table: "td", rel: "d2", target: "d3" },
                { id: "c6", name: "Refacciones", type: "sum", table: "te", rel: "e2", target: "e3" },
                { id: "c7", name: "Total", type: "formula", expr: "{Mano de obra} + {Refacciones}" },
              ],
              rows: [fila("rc1", { c1: "NOTA-001" })],
            },
            {
              id: "td",
              name: "Mano de Obra",
              cols: [
                { id: "d1", name: "Concepto", type: "text" },
                { id: "d2", name: "Servicio", type: "relation", table: "tc" },
                { id: "d3", name: "Importe", type: "number" },
              ],
              rows: [],
            },
            {
              id: "te",
              name: "Refacciones",
              cols: [
                { id: "e1", name: "Refacción", type: "text" },
                { id: "e2", name: "Servicio", type: "relation", table: "tc" },
                { id: "e3", name: "Importe", type: "number" },
                { id: "e4", name: "Cantidad", type: "number" },
              ],
              rows: [],
            },
            { id: "tf", name: "Vehículos", cols: [{ id: "f1", name: "Vehículo", type: "text" }], rows: [fila("rf1", { f1: "Camión rojo" })] },
          ],
        },
      ],
    },
  });
  await restaurar(inventado);
  await p.click("#resOk");
  await p.click("#resOk");
  comprobar("aparecen los dos botones", (await p.locator("#btnGen").isVisible()) && (await p.locator("#btnNota").isVisible()));
  await p.click("#btnGen");
  comprobar("propone el mes siguiente al último", (await p.inputValue("#genMes")) === "2030-02", await p.inputValue("#genMes"));
  const plan = await p.locator("#genInfo").textContent();
  comprobar("planea 2 recurrentes y 1 anual, y avisa del anual sin mes", /Se crearán 3 filas en Cuotas, en Pendiente: 2 recurrentes y 1 anual de febrero\. 1 anual sin mes/.test(plan), plan);
  await p.click("#formGen button[type=submit]");
  comprobar("crea las 3 filas y las deja filtradas", (await p.locator("#conteo").textContent()) === "3 de 4 filas", await p.locator("#conteo").textContent());
  comprobar("quedan en Pendiente", (await p.locator("#grid tbody .pill", { hasText: "Pendiente" }).count()) === 3);
  await p.click("#btnGen");
  await p.fill("#genMes", "2030-02");
  await p.click("#formGen button[type=submit]");
  comprobar("no duplica el mismo mes", (await p.locator("#genError").textContent()).includes("No hay filas"));
  await p.click("#dlgGen [data-close]");

  await p.click("#btnNota");
  await p.fill("#notaTexto", JSON.stringify({ servicio: { id: "NOTA-002", fecha: "2030-02-03", vehiculo: "camion rojo", tipo: "Mantenimiento", km: 1200 }, mano_de_obra: [{ concepto: "Afinación", importe: 500 }], refacciones: [{ refaccion: "Filtro", importe: 150, cantidad: 2 }, { refaccion: "Aceite", importe: 350 }] }));
  await p.click("#formNota button[type=submit]");
  const serv = p.locator("#grid tbody tr").first();
  comprobar("agrega el servicio", (await serv.locator('input[data-cell="c1"]').inputValue()) === "NOTA-002");
  comprobar("suma mano de obra y refacciones", (await serv.locator('[data-calc="c7"]').textContent()) === "1,000", await serv.locator('[data-calc="c7"]').textContent());
  comprobar("reconoce el vehículo aunque cambien acentos y mayúsculas", (await serv.locator("[data-pick]").textContent()) === "Camión rojo");
  comprobar("agrega la opción nueva a la lista de Tipo", (await serv.locator("[data-opt]").textContent()) === "Mantenimiento");
  await p.click("#btnNota");
  await p.fill("#notaTexto", '{"servicio":{"id":"nota-002"}}');
  await p.click("#formNota button[type=submit]");
  comprobar("no repite un folio que ya existe", (await p.locator("#notaError").textContent()).includes("Ya existe"));
  await p.click("#dlgNota [data-close]");

  console.log("Guardado con más espacio");
  const enBD = () =>
    p.evaluate(
      () =>
        new Promise((res) => {
          const rq = indexedDB.open("bases-unificadas", 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore("datos");
          rq.onsuccess = () => {
            const g = rq.result.transaction("datos").objectStore("datos").get("bases-unificadas-v1");
            g.onsuccess = () => res(g.result ? JSON.parse(g.result) : null);
            g.onerror = () => res(null);
          };
          rq.onerror = () => res(null);
        }),
    );
  await p.waitForTimeout(500);
  const guardado = await enBD();
  comprobar("el estado está en el almacén grande", !!guardado && guardado.books[0].name === "Inventado", guardado && guardado.books.map((b) => b.name));
  await p.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("lleno", "QuotaExceededError");
    };
  });
  await p.click('#tabs [data-tab="tf"]');
  await p.click("#btnFila");
  await p.waitForTimeout(600);
  comprobar("si la copia chica no cabe, no hay aviso", await p.locator("#avisoGuardado").isHidden());
  await p.reload();
  await p.click("#iniSeguir");
  await p.click('#tabs [data-tab="tf"]');
  comprobar("y el cambio sigue ahí al recargar", (await conteo()) === "2 filas", await conteo());
  await p.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("lleno", "QuotaExceededError");
    };
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("lleno", "QuotaExceededError");
    };
  });
  await p.click("#btnFila");
  await p.waitForTimeout(600);
  comprobar("avisa cuando no se puede guardar en ningún lado", await p.locator("#avisoGuardado").isVisible());
  comprobar("el aviso no ensancha la página", (await ancho()) <= 0, await ancho());

  console.log("Datos de antes (solo en localStorage)");
  const ctx2 = await nav.newContext({ viewport: { width: 375, height: 740 } });
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errores.push(e.message));
  await p2.goto(URL_APP);
  await p2.evaluate(() => {
    localStorage.setItem(
      "bases-unificadas-v1",
      JSON.stringify({ cur: "bv", books: [{ id: "bv", name: "De antes", tables: [{ id: "tv", name: "Vieja", cols: [{ id: "cv", name: "Nombre", type: "text" }], rows: [{ id: "rv", c: { cv: "sigo aquí" } }] }] }] }),
    );
  });
  await p2.reload();
  comprobar("abre los datos que ya estaban", (await p2.locator("#iniLibros .ini-txt b").textContent()) === "De antes");
  await p2.waitForTimeout(300);
  await p2.evaluate(() => localStorage.clear());
  await p2.reload();
  await p2.click("#iniSeguir");
  comprobar("y ya quedaron copiados al almacén grande", (await p2.locator('#grid input[data-cell="cv"]').inputValue()) === "sigo aquí");
  await ctx2.close();

  comprobar("sin errores en la página", errores.length === 0, errores);
  await nav.close();
  console.log(fallas ? "\n" + fallas + " comprobaciones fallaron." : "\nTodo bien.");
  process.exit(fallas ? 1 : 0);
})();
