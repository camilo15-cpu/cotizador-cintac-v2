const fs = require('fs'), vm = require('vm');
const codigo = fs.readFileSync('static/js/simulador.js', 'utf8');

function el(tag='div'){ const e={tag,children:[],listeners:{},dataset:{},style:{},className:'',_v:'',checked:false,_text:'',_html:'',disabled:false,
  options:[],selectedIndex:0,
  get value(){return this._v}, set value(v){this._v=String(v)},
  addEventListener(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f)},
  appendChild(c){this.children.push(c);return c}, createTextNode(t){return {text:t}},
  set textContent(v){this._text=String(v);this.children=[]}, get textContent(){return this._text},
  set innerHTML(v){this._html=v;this.children=[]}, get innerHTML(){return this._html}};
  return e; }
const ids = ['form-simulador','id_tarifa','id_toneladas','id_contenedores','id_fob_usd','id_dias_transito','id_tipo_cambio','id_acogido_tlc',
  'resultado','btn-guardar','peso-sug','peso-carga','peso-cap','peso-barra','peso-nota'];
const D = {}; ids.forEach(i=>D[i]=el());
D['form-simulador'].dataset = {maxTon:'25', urlCalcular:'/cotizaciones/calcular/'};
D['id_tarifa'].options = [{value:'',dataset:{}},{value:'1',dataset:{dias:'32'}},{value:'2',dataset:{dias:'38'}}];
D['btn-guardar'].disabled = true;

const llamadas = []; let respuesta = {ok:false, errores:['x']};
const ctx = { document:{getElementById:id=>D[id], createElement:t=>el(t), createTextNode:t=>({text:t})},
  Intl, URLSearchParams, parseFloat, isNaN, Math, clearTimeout:()=>{}, setTimeout:f=>{f();return 1},
  fetch:(url)=>{ llamadas.push(url); return Promise.resolve({json:()=>Promise.resolve(respuesta)}) } };
vm.createContext(ctx); vm.runInContext(codigo, ctx);

const disparar = (id, tipo) => (D[id].listeners[tipo]||[]).forEach(f=>f({}));
let ok = 0, fallos = 0;
const check = (nombre, cond, extra='') => { (cond?ok++:fallos++); console.log((cond?'PASS ':'FAIL ')+nombre+(cond?'':'  '+extra)); };
const esperar = () => new Promise(r=>setTimeout(r,5));

(async () => {
  check('estado inicial: sin fetch y botón deshabilitado', llamadas.length===0 && D['btn-guardar'].disabled===true);

  D['id_tarifa'].value='1'; D['id_tarifa'].selectedIndex=1; disparar('id_tarifa','change');
  check('al elegir tarifa se rellenan los días de la tarifa (32)', D['id_dias_transito'].value==='32', D['id_dias_transito'].value);
  D['id_tarifa'].value='2'; D['id_tarifa'].selectedIndex=2; disparar('id_tarifa','change');
  check('otra tarifa cambia los días (38)', D['id_dias_transito'].value==='38');

  D['id_toneladas'].value='60'; disparar('id_toneladas','input');
  check('60 t -> 3 contenedores sugeridos en el campo', D['id_contenedores'].value==='3', D['id_contenedores'].value);
  check('indicador: sugeridos = 3', D['peso-sug'].textContent==='3');
  check('indicador: barra 80%', D['peso-barra'].style.width==='80%', D['peso-barra'].style.width);
  check('indicador: carga/capacidad 60 t / 75 t', D['peso-carga'].textContent==='60 t' && D['peso-cap'].textContent==='75 t', D['peso-carga'].textContent+'/'+D['peso-cap'].textContent);

  for (const [t, esp] of [['25',1],['25.1',2],['50',2],['50.1',3],['0.1',1]]) {
    D['id_toneladas'].value=t; disparar('id_toneladas','input');
    check(`${t} t -> ${esp} contenedor(es)`, D['id_contenedores'].value===String(esp), D['id_contenedores'].value);
  }
  D['id_toneladas'].value='0'; disparar('id_toneladas','input');
  check('0 t -> campo contenedores vacío', D['id_contenedores'].value==='');

  D['id_toneladas'].value='60'; disparar('id_toneladas','input');
  D['id_contenedores'].value='2'; disparar('id_contenedores','input');
  check('2 contenedores para 60 t -> barra roja (excede)', D['peso-barra'].className==='excede' && D['peso-barra'].style.width==='100%', D['peso-barra'].className);
  D['id_contenedores'].value='3'; disparar('id_contenedores','input');
  check('3 contenedores -> barra normal', D['peso-barra'].className==='');

  llamadas.length = 0;
  D['id_fob_usd'].value='85000'; D['id_tipo_cambio'].value='950';
  respuesta = {ok:true, avisos:[], tipo_cobro:'CONTENEDOR', monto_tarifa:'2850.00', dias:32, contenedores:3, toneladas:'60.00',
    porcentaje_contingencia:'5', porcentaje_arancel:'6',
    fob:{usd:'85000.00',clp:80750000}, flete_base:{usd:'8550.00',clp:8122500}, recargo:{usd:'427.50',clp:406125},
    flete_total:{usd:'8977.50',clp:8528625}, seguro:{usd:'0.00',clp:0}, cif:{usd:'93977.50',clp:89278625},
    arancel:{usd:'5638.65',clp:5356718}, iva:{usd:'18927.07',clp:17980717}, total:{usd:'118543.22',clp:112616059}, total_clp:112616059};
  disparar('id_tipo_cambio','input'); await esperar();
  check('se consulta al servidor 1 vez', llamadas.length===1, String(llamadas.length));
  const u = llamadas[0] || '';
  check('URL con tarifa, toneladas, contenedores, fob, días y tc',
    u.startsWith('/cotizaciones/calcular/?') && /tarifa=2/.test(u) && /toneladas=60/.test(u) && /contenedores=3/.test(u) && /fob_usd=85000/.test(u) && /dias_transito=38/.test(u) && /tipo_cambio=950/.test(u), u);
  check('sin TLC no envía acogido_tlc', !/acogido_tlc/.test(u));
  check('resultado: KPIs + tabla en el panel', D['resultado'].children.length===2, String(D['resultado'].children.length));
  check('botón guardar habilitado', D['btn-guardar'].disabled===false);
  const kpis = D['resultado'].children[0].children;
  check('KPI CLP = $ 112.616.059', kpis[0].children[1].textContent==='$ 112.616.059', kpis[0].children[1].textContent);
  check('KPI USD = US$ 118.543,22', kpis[1].children[1].textContent==='US$ 118.543,22', kpis[1].children[1].textContent);
  const filas = D['resultado'].children[1].children[0].children[0].children; // tabla > cuerpo > filas (cuerpo es el único hijo agregado tras innerHTML)
  check('tabla con 9 filas de concepto', filas.length===9, String(filas.length));

  llamadas.length = 0; D['id_acogido_tlc'].checked = true; disparar('id_acogido_tlc','change'); await esperar();
  check('con TLC se envía acogido_tlc=on', /acogido_tlc=on/.test(llamadas[0]||''), llamadas[0]);

  respuesta = {ok:false, errores:['Contenedores: Con 2 contenedor(es) la carga supera el máximo de 25 t por contenedor (Decreto 75).']};
  disparar('id_fob_usd','input'); await esperar();
  check('error del servidor se muestra y el botón se bloquea', D['resultado'].children.length===1 && D['resultado'].children[0].className==='alerta error' && D['btn-guardar'].disabled===true);
  check('el texto del error se inserta como texto (no HTML)', D['resultado'].children[0].textContent.includes('Decreto 75') && D['resultado'].children[0].innerHTML==='');

  llamadas.length = 0; D['id_tipo_cambio'].value='0'; disparar('id_tipo_cambio','input'); await esperar();
  check('tipo de cambio 0 no consulta y muestra el vacío', llamadas.length===0 && D['resultado'].children[0].className==='vacio');

  console.log(`\n${ok}/${ok+fallos} OK`); process.exit(fallos?1:0);
})();
