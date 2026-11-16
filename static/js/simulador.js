/* Simulador: vista previa en vivo.
   El cálculo oficial lo hace el servidor (/cotizaciones/calcular/); aquí solo se muestra el resultado
   y se actualizan los campos de apoyo (días de la tarifa, contenedores sugeridos, indicador de carga). */
(function () {
  'use strict';
  var form = document.getElementById('form-simulador');
  if (!form) { return; }

  var MAX_TON = parseFloat(form.dataset.maxTon) || 25;
  var URL_CALCULAR = form.dataset.urlCalcular;
  var $ = function (id) { return document.getElementById(id); };
  var c = {
    tarifa: $('id_tarifa'), toneladas: $('id_toneladas'), contenedores: $('id_contenedores'),
    fob: $('id_fob_usd'), dias: $('id_dias_transito'), tc: $('id_tipo_cambio'), tlc: $('id_acogido_tlc')
  };
  var panel = $('resultado'), btnGuardar = $('btn-guardar'), pedido = 0, temporizador = null;

  var nf0 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var usd = function (v) { return 'US$ ' + nf2.format(parseFloat(v)); };
  var clp = function (v) { return '$ ' + nf0.format(v); };
  var num = function (el) { var v = parseFloat(el.value); return isNaN(v) ? 0 : v; };

  /* ---- Indicador de contenedores (se actualiza al escribir) ---- */
  function renderPeso() {
    var ton = num(c.toneladas);
    var sug = ton > 0 ? Math.ceil(ton / MAX_TON - 1e-9) : 0;
    var cont = num(c.contenedores) > 0 ? num(c.contenedores) : sug;
    var cap = cont * MAX_TON;
    var pct = cap > 0 ? (ton / cap) * 100 : 0;
    $('peso-sug').textContent = sug;
    $('peso-carga').textContent = nf1.format(ton) + ' t';
    $('peso-cap').textContent = nf1.format(cap) + ' t';
    var barra = $('peso-barra');
    barra.style.width = Math.min(pct, 100) + '%';
    barra.className = ton > cap && ton > 0 ? 'excede' : '';
    $('peso-nota').textContent = 'Ocupación: ' + nf1.format(pct) + '% · Restricción legal Decreto 75 (máx. ' +
      nf0.format(MAX_TON) + ' t por contenedor)';
  }

  /* ---- Panel de resultado ---- */
  function fila(concepto, detalle, par, clase) {
    var tr = document.createElement('tr');
    if (clase) { tr.className = clase; }
    var td = document.createElement('td');
    td.appendChild(document.createTextNode(concepto));
    if (detalle) {
      td.appendChild(document.createElement('br'));
      var pequena = document.createElement('small');
      pequena.style.color = 'var(--gris)';
      pequena.textContent = detalle;
      td.appendChild(pequena);
    }
    tr.appendChild(td);
    [usd(par.usd), clp(par.clp)].forEach(function (texto) {
      var celda = document.createElement('td');
      celda.className = 'num';
      celda.textContent = texto;
      tr.appendChild(celda);
    });
    return tr;
  }

  function mostrarVacio(mensaje) {
    panel.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'vacio';
    div.textContent = mensaje || 'Selecciona una tarifa e ingresa las toneladas para ver la cotización.';
    panel.appendChild(div);
    btnGuardar.disabled = true;
  }

  function mostrarErrores(errores) {
    panel.innerHTML = '';
    errores.forEach(function (texto) {
      var div = document.createElement('div');
      div.className = 'alerta error';
      div.textContent = texto;
      panel.appendChild(div);
    });
    btnGuardar.disabled = true;
  }

  function kpi(titulo, valor, principal) {
    var div = document.createElement('div');
    div.className = 'resumen-kpi' + (principal ? ' principal' : '');
    var s = document.createElement('span'); s.textContent = titulo;
    var b = document.createElement('b'); b.textContent = valor;
    div.appendChild(s); div.appendChild(b);
    return div;
  }

  function mostrarResultado(r) {
    panel.innerHTML = '';
    (r.avisos || []).forEach(function (texto) {
      var aviso = document.createElement('div');
      aviso.className = 'alerta warning';
      aviso.textContent = texto;
      panel.appendChild(aviso);
    });

    var kpis = document.createElement('div');
    kpis.className = 'resumen-kpis';
    kpis.appendChild(kpi('Costo total importación (CLP)', clp(r.total_clp), true));
    kpis.appendChild(kpi('Costo total importación (USD)', usd(r.total.usd), false));
    panel.appendChild(kpis);

    var cantidad = r.tipo_cobro === 'CONTENEDOR' ? r.contenedores + ' contenedor(es)' : nf1.format(parseFloat(r.toneladas)) + ' t';
    var contenedor = document.createElement('div');
    contenedor.className = 'tabla';
    var tabla = document.createElement('table');
    tabla.innerHTML = '<thead><tr><th>Concepto</th><th class="num">USD</th><th class="num">CLP</th></tr></thead>';
    var cuerpo = document.createElement('tbody');
    cuerpo.appendChild(fila('Valor FOB', '', r.fob));
    cuerpo.appendChild(fila('Flete base', usd(r.monto_tarifa) + ' × ' + cantidad, r.flete_base));
    cuerpo.appendChild(fila('Contingencia logística (+' + r.porcentaje_contingencia + '%)', r.dias + ' días de tránsito', r.recargo));
    cuerpo.appendChild(fila('Flete total con margen', '', r.flete_total, 'subtotal'));
    cuerpo.appendChild(fila('Seguro', 'exento, póliza global CINTAC', r.seguro));
    cuerpo.appendChild(fila('Valor CIF', '', r.cif, 'subtotal'));
    cuerpo.appendChild(fila(r.porcentaje_arancel === '0' ? 'Arancel (TLC 0%)' : 'Arancel (' + r.porcentaje_arancel + '% s/CIF)', '', r.arancel));
    cuerpo.appendChild(fila('IVA (19% s/CIF + arancel)', '', r.iva));
    cuerpo.appendChild(fila('TOTAL', '', r.total, 'total'));
    tabla.appendChild(cuerpo);
    contenedor.appendChild(tabla);
    panel.appendChild(contenedor);
    btnGuardar.disabled = false;
  }

  /* ---- Consulta al servidor (con "debounce" para no saturarlo) ---- */
  function calcular() {
    if (!c.tarifa.value || !(num(c.toneladas) > 0) || c.fob.value === '' || !(num(c.tc) > 0)) {
      mostrarVacio();
      return;
    }
    var params = new URLSearchParams();
    params.set('tarifa', c.tarifa.value);
    params.set('toneladas', c.toneladas.value);
    params.set('contenedores', c.contenedores.value);
    params.set('fob_usd', c.fob.value);
    params.set('dias_transito', c.dias.value);
    params.set('tipo_cambio', c.tc.value);
    if (c.tlc.checked) { params.set('acogido_tlc', 'on'); }

    var miPedido = ++pedido;
    fetch(URL_CALCULAR + '?' + params.toString(), { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
      .then(function (resp) { return resp.json(); })
      .then(function (datos) {
        if (miPedido !== pedido) { return; }               // llegó una respuesta más antigua
        if (datos.ok) { mostrarResultado(datos); } else { mostrarErrores(datos.errores || ['Revisa los datos ingresados.']); }
      })
      .catch(function () {
        if (miPedido === pedido) { mostrarErrores(['No se pudo calcular la cotización. Revisa tu conexión.']); }
      });
  }

  function programar() {
    clearTimeout(temporizador);
    temporizador = setTimeout(calcular, 250);
  }

  /* ---- Eventos ---- */
  c.tarifa.addEventListener('change', function () {
    var opcion = c.tarifa.options[c.tarifa.selectedIndex];
    if (opcion && opcion.dataset.dias) { c.dias.value = opcion.dataset.dias; }   // días de la tarifa elegida
    programar();
  });
  c.toneladas.addEventListener('input', function () {
    var ton = num(c.toneladas);
    c.contenedores.value = ton > 0 ? Math.ceil(ton / MAX_TON - 1e-9) : '';      // mínimo sugerido
    renderPeso();
    programar();
  });
  c.contenedores.addEventListener('input', function () { renderPeso(); programar(); });
  [c.fob, c.dias, c.tc].forEach(function (el) { el.addEventListener('input', programar); });
  c.tlc.addEventListener('change', programar);

  /* Estado inicial (también al volver a mostrar el formulario con datos) */
  if (c.tarifa.value && c.dias.value === '') {
    var inicial = c.tarifa.options[c.tarifa.selectedIndex];
    if (inicial && inicial.dataset.dias) { c.dias.value = inicial.dataset.dias; }
  }
  if (num(c.toneladas) > 0 && c.contenedores.value === '') {
    c.contenedores.value = Math.ceil(num(c.toneladas) / MAX_TON - 1e-9);
  }
  renderPeso();
  calcular();
})();
