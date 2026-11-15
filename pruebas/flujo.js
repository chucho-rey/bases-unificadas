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

  console.log("Fórmulas");
  await p.click('#grid [data-col="v_tot"]');
  await p.fill("#colExpr", "{ cantidad } * {Precio}");
  await p.click("#formCol button[type=submit]");
  await p.click('#grid [data-col="v_can"]');
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

  console.log("Aviso de guardado");
  await p.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("lleno", "QuotaExceededError");
    };
  });
  await p.click("#btnFila");
  await p.waitForTimeout(500);
  comprobar("avisa cuando no se puede guardar", await p.locator("#avisoGuardado").isVisible());
  comprobar("el aviso no ensancha la página", (await ancho()) <= 0, await ancho());

  comprobar("sin errores en la página", errores.length === 0, errores);
  await nav.close();
  console.log(fallas ? "\n" + fallas + " comprobaciones fallaron." : "\nTodo bien.");
  process.exit(fallas ? 1 : 0);
})();
