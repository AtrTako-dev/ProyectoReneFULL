/**
 * PulsoStock V3: generador reproducible de ventas SEMANALES SINTÉTICAS.
 * NO contiene ventas observadas de Soriana ni precios extraídos de PROFECO.
 * El archivo indicadores_reales_2026.csv se conserva APARTE.
 * Ejecutar: node generar_dataset.js
 * Sin dependencias externas.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = import.meta.dirname;
const BASE_SEED=20261119>>>0;
let state=BASE_SEED;
function setSeed(seed){state=seed>>>0;}
function rand(){state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
function rnd(min,max){return min+(max-min)*rand();}
function int(min,max){return Math.floor(rnd(min,max+1));}
function round(v,d=2){return Number(v.toFixed(d));}
function dateISO(x){return x.toISOString().slice(0,10);}
function addDays(d,days){const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+days);return dateISO(t);}
function overlaps(a,b,start,end){return a<=end && b>=start;}
function events(start,end){
 const year=Number(start.slice(0,4));
 const relevant=[year-1,year,year+1];
 const has=(ranges)=>relevant.some(y=>ranges[y]?.some(([s,e])=>overlaps(start,end,s,e)));
 const buen={2023:[['2023-11-17','2023-11-20']],2024:[['2024-11-15','2024-11-18']],2025:[['2025-11-13','2025-11-17']],2026:[['2026-11-13','2026-11-17']]};
 const bf={2023:[['2023-11-24','2023-11-24']],2024:[['2024-11-29','2024-11-29']],2025:[['2025-11-28','2025-11-28']],2026:[['2026-11-27','2026-11-27']]};
 const cyber={2023:[['2023-11-27','2023-11-27']],2024:[['2024-12-02','2024-12-02']],2025:[['2025-12-01','2025-12-01']],2026:[['2026-11-30','2026-11-30']]};
 const x={es_buen_fin:Number(has(buen)),es_black_friday:Number(has(bf)),es_cyber_monday:Number(has(cyber)),es_navidad:0,es_regreso_clases:0,es_dia_madres:0};
 for(const y of relevant){if(overlaps(start,end,`${y}-12-05`,`${y+1}-01-06`))x.es_navidad=1;if(overlaps(start,end,`${y}-08-01`,`${y}-09-08`))x.es_regreso_clases=1;if(overlaps(start,end,`${y}-05-04`,`${y}-05-12`))x.es_dia_madres=1;}
 return x;
}
// Cada entrada: [nombre del producto, marca de referencia, unidad, precio BASE SIMULADO, demanda base semanal de matriz].
const CAT = [
 ['Frutas',[
 ['Manzana roja','A granel','kg',49,120],['Plátano Chiapas','A granel','kg',30,180],['Naranja Valencia','A granel','kg',31,160],['Mango ataulfo','A granel','kg',55,120],['Papaya maradol','A granel','kg',43,105],['Uva verde','A granel','kg',95,65],['Fresa 454 g','A granel','paquete',69,80],['Pera de anjou','A granel','kg',59,74],['Limón sin semilla','A granel','kg',40,155],['Sandía rayada','A granel','kg',18,180]]],
 ['Verduras',[
 ['Jitomate saladet','A granel','kg',35,200],['Cebolla blanca','A granel','kg',31,173],['Papa blanca','A granel','kg',34,177],['Zanahoria','A granel','kg',22,110],['Chile serrano','A granel','kg',46,80],['Pepino','A granel','kg',28,94],['Calabacita','A granel','kg',36,92],['Lechuga romana','A granel','pieza',27,140],['Brócoli','A granel','kg',43,78],['Aguacate hass','A granel','kg',73,122]]],
 ['Panadería',[
 ['Pan blanco 680 g','Bimbo','paquete',48,104],['Pan integral 680 g','Bimbo','paquete',55,84],['Mantecadas 3 piezas','Bimbo','paquete',31,102],['Donitas 105 g','Bimbo','paquete',26,88],['Galletas surtidas 330 g','Gamesa','paquete',55,80],['Roles canela 3 piezas','Marinela','paquete',29,78],['Concha tradicional','Panadería local','pieza',13,235],['Bolillo','Panadería local','pieza',3,440],['Pastel chocolate chico','Panadería local','pieza',199,36],['Rebanada pastel tres leches','Panadería local','pieza',49,68]]],
 ['Electrónica',[
 ['Audífonos inalámbricos básicos','Xiaomi','pieza',449,17],['Mouse inalámbrico','Logitech','pieza',279,25],['Memoria USB 64 GB','Kingston','pieza',189,24],['Tarjeta microSD 64 GB','SanDisk','pieza',159,20],['Bocina Bluetooth portátil','JBL','pieza',899,13],['Teclado USB compacto','Logitech','pieza',309,16],['Cargador USB-C 20 W','Samsung','pieza',399,26],['Cable USB-C 1 m','Ugreen','pieza',149,37],['Webcam HD','Logitech','pieza',689,9],['Power bank 10000 mAh','Xiaomi','pieza',499,18]]],
 ['Abarrotes',[
 ['Arroz 1 kg','Verde Valle','bolsa',39,175],['Frijol bayo 900 g','Verde Valle','bolsa',44,130],['Aceite vegetal 850 ml','1-2-3','botella',43,150],['Atún en agua 140 g','Tuny','lata',27,167],['Pasta espagueti 200 g','La Moderna','bolsa',14,260],['Salsa de tomate 210 g','La Costeña','lata',19,158],['Mayonesa 390 g','McCormick','frasco',51,89],['Harina de maíz 1 kg','Maseca','bolsa',27,157],['Sal refinada 1 kg','La Fina','bolsa',21,105],['Cereal de maíz 500 g','Kellogg’s','caja',76,72]]],
 ['Bebidas',[
 ['Refresco cola 600 ml','Coca-Cola','botella',22,278],['Refresco cola 600 ml','Pepsi','botella',19,179],['Agua natural 1 L','Bonafont','botella',18,218],['Agua natural 1.5 L','Ciel','botella',19,190],['Jugo naranja 1 L','Jumex','envase',30,131],['Bebida hidratante 625 ml','Electrolit','botella',38,150],['Té helado 600 ml','Fuze Tea','botella',22,112],['Agua mineral 600 ml','Topo Chico','botella',28,89],['Bebida sabor manzana 600 ml','Sidral Mundet','botella',21,105],['Bebida deportiva 600 ml','Gatorade','botella',29,138]]],
 ['Lácteos',[
 ['Leche entera 1 L','Lala','envase',32,250],['Leche deslactosada 1 L','Lala','envase',35,168],['Leche entera 1 L','Alpura','envase',32,200],['Yogur natural 900 g','Danone','envase',49,89],['Yogur bebible 220 g','Yakult','paquete',31,113],['Queso panela 400 g','Lala','paquete',89,90],['Queso manchego 400 g','Nochebuena','paquete',115,65],['Crema 450 ml','Lala','envase',48,83],['Mantequilla 90 g','Lala','barra',35,77],['Leche evaporada 360 g','Carnation','lata',31,91]]],
 ['Limpieza',[
 ['Detergente polvo 1 kg','Ariel','bolsa',62,117],['Detergente polvo 1 kg','Roma','bolsa',32,89],['Limpiador multiusos 1 L','Pinol','botella',42,106],['Cloro 950 ml','Cloralex','botella',24,133],['Suavizante 850 ml','Suavitel','botella',42,100],['Lavatrastes 750 ml','Axion','botella',44,91],['Jabón en barra 400 g','Zote','barra',25,89],['Detergente líquido 830 ml','Ariel','botella',65,93],['Papel sanitario 4 rollos','Regio','paquete',46,160],['Toallas cocina 2 rollos','Pétalo','paquete',39,92]]],
 ['Higiene',[
 ['Pasta dental 100 ml','Colgate','caja',36,118],['Cepillo dental mediano','Oral-B','pieza',39,103],['Jabón corporal 90 g','Dove','barra',29,128],['Shampoo 400 ml','Pantene','envase',85,76],['Desodorante aerosol','Rexona','envase',69,87],['Crema corporal 400 ml','Nivea','envase',96,69],['Pañales talla mediana 40 pzas','Huggies','paquete',289,48],['Toallas femeninas 12 pzas','Kotex','paquete',43,88],['Pañuelos desechables 90 pzas','Kleenex','caja',38,79],['Shampoo anticaspa 375 ml','Head & Shoulders','envase',95,74]]],
 ['Papelería',[
 ['Cuaderno profesional 100 hojas','Scribe','pieza',49,105],['Pluma tinta azul','Bic','pieza',9,195],['Lápiz escolar HB','Dixon','pieza',8,177],['Colores 12 piezas','Crayola','caja',69,111],['Pegamento barra 21 g','Pritt','pieza',35,89],['Resaltador amarillo','Sharpie','pieza',26,75],['Juego geometría','Maped','juego',69,78],['Corrector cinta','Kores','pieza',28,71],['Marcador permanente negro','Sharpie','pieza',31,115],['Carpeta tamaño carta','Norma','pieza',49,80]]]
];
const products=[];
CAT.forEach(([categoria,list],ci)=>list.forEach(([producto,marca,unidad,basePrecio,baseDemanda],pi)=>products.push({producto_id:`PS${String(ci*10+pi+1).padStart(3,'0')}`,producto,categoria,marca,unidad,precio_base_simulado_mxn:basePrecio,demanda_base_simulada:baseDemanda,grupo:ci})));
if(products.length!==100)throw new Error('Se esperaban 100 productos');
const columns=['registro_id','negocio_id','usuario_id','negocio','es_referencia_matriz','semana_numero','fecha_inicio','fecha_fin','anio','mes','producto_id','producto','marca','categoria','unidad','precio_lista_mxn','descuento_pct','precio_unitario_mxn','unidades_vendidas','ingresos_mxn','costo_unitario_mxn','utilidad_bruta_mxn','inventario_inicial','reabastecimiento_unidades','merma_unidades','inventario_final','ventas_semana_anterior','es_buen_fin','es_black_friday','es_cyber_monday','es_navidad','es_regreso_clases','es_dia_madres','es_promocion','origen_ventas'];
function csvEscape(v){let s=v==null?'':String(v);return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
function writeCsv(name,rows,headers=columns){const content='\ufeff'+headers.join(',')+'\r\n'+rows.map(r=>headers.map(h=>csvEscape(r[h])).join(',')).join('\r\n')+'\r\n';fs.writeFileSync(path.join(OUT,name),content,'utf8');}
function writeJson(name,rows){fs.writeFileSync(path.join(OUT,name),JSON.stringify(rows,null,2),'utf8');}
function priceFor(p,weekIdx,isChild){const yearFactor=Math.pow(1.044,weekIdx/52);const phase=Math.sin(2*Math.PI*weekIdx/13+p.grupo);const jitter=(p.grupo<2)?1+0.065*Math.sin(weekIdx*.18+p.grupo*3)+rnd(-.11,.11):1+.008*phase+rnd(-.007,.007);return round(Math.max(2, p.precio_base_simulado_mxn*yearFactor*jitter*(isChild?rnd(1.035,1.1):1)));}
function seasonFactor(p,date,flags,isReference){const m=Number(date.slice(5,7));let f=1;
 if(p.categoria==='Electrónica'&&(flags.es_buen_fin||flags.es_black_friday||flags.es_cyber_monday))f*=1.9;
 if(p.categoria==='Electrónica'&&flags.es_navidad)f*=1.25;
 if(p.categoria==='Papelería'&&flags.es_regreso_clases)f*=2.2;
 if(p.categoria==='Panadería'&&flags.es_navidad)f*=1.5;
 if(p.categoria==='Abarrotes'&&(flags.es_navidad||flags.es_buen_fin))f*=1.18;
 if(p.categoria==='Bebidas'&&[4,5,6,7,8].includes(m))f*=1.38;
 if(p.categoria==='Lácteos'&&flags.es_navidad)f*=1.12;
 if(p.categoria==='Limpieza'&&flags.es_buen_fin)f*=1.24;
 if((p.categoria==='Frutas'||p.categoria==='Verduras')&&[3,4,5,6,7].includes(m))f*=1.13;
 if(p.categoria==='Higiene'&&flags.es_buen_fin)f*=1.25;
 if(flags.es_dia_madres&&p.categoria==='Panadería')f*=1.2;
 // Señal de escenario INSPIRADA por la caída observada de Soriana 3T26, NO es una calibración a sus ventas.
 if(isReference&&date>='2026-07-01'&&date<='2026-09-30')f*=0.97;
 return f;
}
function createRow({p,baseDemand,weekIdx,fechaInicio,usuario_id,negocio_id,negocio,isRef,prev}){
 const fechaFin=addDays(fechaInicio,6),flags=events(fechaInicio,fechaFin),list=priceFor(p,weekIdx,!isRef);
 const promoChance=.10+(flags.es_buen_fin?.35:0)+(flags.es_regreso_clases&&p.categoria==='Papelería'?.24:0)+(flags.es_navidad?.08:0);
 const descuento=rand()<promoChance?[5,10,15,20][int(0,3)]:0;
 const precio=round(list*(1-descuento/100));
 const initial=prev?prev.inventario_final:Math.max(10,Math.round(baseDemand*2.2));
 const season=seasonFactor(p,fechaInicio,flags,isRef);
 const yearlyDrift=1+0.018*Math.sin(weekIdx/17+p.grupo);
 const expected=baseDemand*season*yearlyDrift*(descuento?1+descuento/95:1);
 let demand=Math.max(0,Math.round(expected*(1+rnd(-.23,.23))));
 const target=Math.ceil(Math.max(expected*1.5,(prev?.unidades_vendidas||expected)*1.3));
 const replenish=Math.max(0,Math.round(target*1.3-initial));
 const sold=Math.min(demand,initial+replenish);
 const rem= (p.grupo<=2)?Math.min(initial+replenish-sold,Math.floor((initial+replenish-sold)*rnd(0,.06))):0;
 const end=initial+replenish-sold-rem;
 const cost=round(list*(p.categoria==='Electrónica'?rnd(.79,.87):rnd(.59,.77)));
 const ingresos=round(precio*sold);
 const util=round((precio-cost)*sold);
 const row={registro_id:`PS3-${String(negocio_id)}-${String(weekIdx+1).padStart(3,'0')}-${p.producto_id}`,
 negocio_id,usuario_id,negocio,es_referencia_matriz:Number(isRef),semana_numero:isRef?weekIdx+1:weekIdx-150+1,
 fecha_inicio:fechaInicio,fecha_fin:fechaFin,anio:Number(fechaInicio.slice(0,4)),mes:Number(fechaInicio.slice(5,7)),producto_id:p.producto_id,producto:p.producto,marca:p.marca,categoria:p.categoria,unidad:p.unidad,
 precio_lista_mxn:list,descuento_pct:descuento,precio_unitario_mxn:precio,unidades_vendidas:sold,ingresos_mxn:ingresos,costo_unitario_mxn:cost,utilidad_bruta_mxn:util,
 inventario_inicial:initial,reabastecimiento_unidades:replenish,merma_unidades:rem,inventario_final:end,
 ventas_semana_anterior:prev?prev.unidades_vendidas:'',
 ...flags,es_promocion:Number(descuento>0),origen_ventas:'SIMULADO_EDUCATIVO'};
 if(end!==initial+replenish-sold-rem)throw Error('Error inventario');
 return row;
}
const start='2023-01-16';
const matriz=[],lastMatrix=new Map();
setSeed(BASE_SEED);
// Se genera por semana para que todos los productos compartan los mismos periodos.
for(let w=0;w<200;w++){
 const dt=addDays(start,w*7);
 for(const p of products){
  const prev=lastMatrix.get(p.producto_id);
  const row=createRow({p,baseDemand:p.demanda_base_simulada,weekIdx:w,fechaInicio:dt,usuario_id:0,negocio_id:900,negocio:'Soriana (SIMULACIÓN NO OFICIAL)',isRef:true,prev});
  matriz.push(row);lastMatrix.set(p.producto_id,row);
 }
}
if(matriz.length!==20000)throw Error('Matriz no tiene 20000 filas');
// Cada negocio usa una demanda base propia por SKU, independiente de la serie de la matriz.
const negocios=[
 {usuario_id:1,negocio_id:201,nombre:'Frutería La Huerta',giro:'Frutas y verduras',categorias:['Frutas','Verduras'],indexes:[0,1,2,3,4,10,11,12,13,14],demandaMin:10,demandaMax:35},
 {usuario_id:2,negocio_id:202,nombre:'Panadería La Espiga',giro:'Panadería y pastelería',categorias:['Panadería'],indexes:[20,21,22,23,24,25,26,27,28,29],demandaMin:10,demandaMax:100},
 {usuario_id:3,negocio_id:203,nombre:'Electrónica Punto Digital',giro:'Tienda de electrónica',categorias:['Electrónica'],indexes:[30,31,32,33,34,35,36,37,38,39],demandaMin:3,demandaMax:16},
 {usuario_id:4,negocio_id:204,nombre:'Abarrotes El Puente',giro:'Abarrotes',categorias:['Abarrotes','Bebidas','Lácteos'],indexes:[40,41,42,43,44,45,50,51,60,61],demandaMin:12,demandaMax:50},
 {usuario_id:5,negocio_id:205,nombre:'Papel y Tinta',giro:'Papelería',indexes:[90,91,92,93,94,95,96,97,98,99],demandaMin:8,demandaMax:45}
];
const children=[],childSets={},assortmentRows=[];
for(const n of negocios){
 setSeed(BASE_SEED^n.negocio_id);
 let own=[],last=new Map(),assortment=new Map();
 for(const pi of n.indexes){
  const p=products[pi],baseDemand=int(n.demandaMin,n.demandaMax);
  assortment.set(p.producto_id,baseDemand);
  assortmentRows.push({negocio_id:n.negocio_id,producto_id:p.producto_id});
 }
 for(let w=150;w<200;w++){
  const dt=addDays(start,w*7);
  for(const pi of n.indexes){
   const p=products[pi],prev=last.get(p.producto_id);
   const row=createRow({p,baseDemand:assortment.get(p.producto_id),weekIdx:w,fechaInicio:dt,usuario_id:n.usuario_id,negocio_id:n.negocio_id,negocio:n.nombre,isRef:false,prev});
   own.push(row);children.push(row);last.set(p.producto_id,row);
  }
 }
 if(own.length!==500)throw Error(`${n.nombre} != 500`);
 childSets[n.negocio_id]=own;
}
writeCsv('matriz_soriana_simulada_20000.csv',matriz);
for(const n of negocios){
 const file=`tienda_${n.usuario_id}_${n.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_').toLowerCase()}`;
 writeCsv(`${file}_500.csv`,childSets[n.negocio_id]);
 n.csv=`${file}_500.csv`;
}
writeCsv('catalogo_100_productos.csv',products,['producto_id','producto','marca','categoria','unidad']);
writeCsv('surtido_por_negocio.csv',assortmentRows,['negocio_id','producto_id']);
writeCsv('usuarios_y_negocios.csv',negocios.map(n=>({usuario_id:n.usuario_id,negocio_id:n.negocio_id,nombre:n.nombre,giro:n.giro,registros:500})),['usuario_id','negocio_id','nombre','giro','registros']);
// Datos reales citados de fuentes públicas y SIN fusión transaccional; no sirven como tickets de venta.
const indicators=[
 {fuente:'Soriana',periodo:'2026-T3',indicador:'Ingresos totales trimestre',valor:40833,unidad:'millones MXN',publicacion:'2026-10-30',url:'https://www.organizacionsoriana.com/pdf/reportes/2026/3T_2026_Espanol_InfDirVfinal.pdf',nota:'Dato consolidado real, no ventas por producto'},
 {fuente:'Soriana',periodo:'2025-T3',indicador:'Ingresos totales trimestre',valor:42683,unidad:'millones MXN',publicacion:'2026-10-30',url:'https://www.organizacionsoriana.com/pdf/reportes/2026/3T_2026_Espanol_InfDirVfinal.pdf',nota:'Comparativo publicado en informe 2026'},
 {fuente:'Soriana',periodo:'2026-T3',indicador:'Variacion ventas mismas tiendas',valor:-3.6,unidad:'porcentaje interanual',publicacion:'2026-10-30',url:'https://www.organizacionsoriana.com/pdf/reportes/2026/3T_2026_Espanol_InfDirVfinal.pdf',nota:'No desglosa producto; no calibración de registros sintéticos'},
 {fuente:'Soriana',periodo:'2026-01 a 2026-09',indicador:'Ingresos acumulados',valor:124836,unidad:'millones MXN',publicacion:'2026-10-30',url:'https://www.organizacionsoriana.com/pdf/reportes/2026/3T_2026_Espanol_InfDirVfinal.pdf',nota:'Cifra consolidada nacional'},
 {fuente:'INEGI EMEC',periodo:'2026-08',indicador:'Variacion mensual ingresos comercio minorista',valor:1.2,unidad:'porcentaje mensual desestacionalizado',publicacion:'2026-10',url:'https://en.www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/emec/emec2026_10.pdf',nota:'Indicador sectorial, NO ventas de Soriana ni por categoría'},
 {fuente:'ANTAD',periodo:'2026-10',indicador:'Crecimiento nominal tiendas iguales',valor:1.6,unidad:'porcentaje interanual',publicacion:'2026-11-13',url:'https://antad.net/indicadores/crecimiento-nominal-en-ventas/',nota:'Total de cadenas afiliadas; no ventas por producto'},
 {fuente:'ANTAD',periodo:'2026-10',indicador:'Crecimiento nominal tiendas totales',valor:4.1,unidad:'porcentaje interanual',publicacion:'2026-11-13',url:'https://antad.net/indicadores/crecimiento-nominal-en-ventas/',nota:'Total de cadenas afiliadas; no ventas por producto'},
 {fuente:'PROFECO',periodo:'2026-09-14 a 2026-09-18',indicador:'Canasta PACIC menor precio Mega Soriana La Diana Acapulco',valor:739.90,unidad:'MXN por canasta de 24 productos',publicacion:'2026-10',url:'https://www.gob.mx/profeco/prensa/profeco-presenta-mapa-de-calor-para-identificar-los-precios-de-los-24-productos-de-la-canasta-pacic-por-cadena-comercial?idiom=es-MX',nota:'Un caso documentado, NO precio individual ni promedio nacional'},
];
writeCsv('indicadores_reales_2026.csv',indicators,['fuente','periodo','indicador','valor','unidad','publicacion','url','nota']);
const sum={version:'v3',generado:'2026-11-19',estatus:'100% ventas sintéticas; indicadores públicos reales separados',matriz:{negocio:'Soriana (SIMULACIÓN NO OFICIAL)',filas:matriz.length,skus:products.length,primer_periodo:matriz[0].fecha_inicio,ultimo_periodo:matriz[matriz.length-1].fecha_fin,archivo_csv:'matriz_soriana_simulada_20000.csv'},tiendas:negocios.map(n=>({usuario_id:n.usuario_id,negocio_id:n.negocio_id,nombre:n.nombre,registros:childSets[n.negocio_id].length,primer_periodo:childSets[n.negocio_id][0].fecha_inicio,ultimo_periodo:childSets[n.negocio_id][499].fecha_fin,archivo_csv:n.csv})),surtido_por_negocio_csv:'surtido_por_negocio.csv',total_registros_ventas:matriz.length+children.length,indicadores_reales:indicators.length};
writeJson('resumen.json',sum);
const doc=`# PulsoStock v3 — matriz de referencia no oficial y cinco negocios

**Uso exclusivamente académico.** Todos los registros de ventas, precios por producto, costos e inventarios son sintéticos. La matriz usa Soriana como referencia de escenario, pero no contiene transacciones oficiales de Soriana, PROFECO ni INEGI. Los indicadores públicos se conservan por separado en indicadores_reales_2026.csv.

## Archivos y granularidad

- matriz_soriana_simulada_20000.csv: 20,000 agregados semanales, 100 productos por 200 semanas, del 16 de enero de 2023 al 15 de noviembre de 2026. Es una referencia sintética con negocio_id=900 y usuario_id=0; no es una cuenta autenticable.
- Cada uno de los cinco archivos tienda_*_500.csv contiene 500 agregados semanales, 10 productos por 50 semanas, del 1 de diciembre de 2025 al 15 de noviembre de 2026. Los negocio_id 201–205 y usuario_id 1–5 son identificadores sintéticos de ejemplo; no representan cuentas ni personas existentes.
- catalogo_100_productos.csv contiene el catálogo global de 100 productos y sus unidades.
- surtido_por_negocio.csv contiene los 50 pares negocio-producto de las tiendas. La matriz de referencia usa el catálogo completo y no es parte del surtido de una cuenta autenticable.
- usuarios_y_negocios.csv relaciona IDs sintéticos de usuario y negocio; no contiene credenciales ni acredita cuentas existentes.
- indicadores_reales_2026.csv contiene ocho indicadores públicos agregados con fuente, período, unidad y referencia. No son ventas por producto.
- resumen.json registra las cantidades y rutas de los archivos canónicos.

Cada semana se representa con una fila por producto y entidad. El catálogo es global y se comparte por producto_id. Las tiendas tienen surtidos explícitos y parámetros de demanda propios por producto; sus ventas semanales no se calculan a partir de la serie de ventas de la matriz. Comparten definiciones del catálogo y factores de calendario, no ventas observadas.

precio_base_simulado_mxn, demanda_base_simulada y demanda_base_semanal_simulada son parámetros internos del simulador. No se exportan en los CSV canónicos y no son columnas operativas ni features de ML.

La fuente canónica de ventas consta de la matriz CSV y los cinco CSV de tiendas. El generador no crea JSON de ventas ni un CSV consolidado: eran copias redundantes de los CSV canónicos. No se deben importar simultáneamente esas exportaciones antiguas junto con los CSV canónicos.

## Predicción y evaluación

El objetivo de predicción es unidades_vendidas de la semana siguiente. La matriz permite una separación temporal de semanas 1–160 para entrenamiento, 161–180 para validación y 181–200 para prueba. Las tiendas tienen solo 50 semanas; semanas 41–50 forman una prueba breve. No se deben mezclar semanas futuras en el ajuste.

ventas_semana_anterior es el rezago del mismo producto y negocio; está vacío en la primera semana de cada serie. No se genera una columna de rezago de ventas de matriz en las tiendas. Los precios y descuentos solo deben usarse para pronóstico si se conocen de antemano. No usar ingresos_mxn, utilidad_bruta_mxn ni inventario_final de la semana objetivo como variables de entrada: son valores derivados de esa semana y provocarían fuga de información.

El modelo puede aprender patrones de este simulador, pero una buena precisión no demuestra capacidad de pronosticar ventas reales. Para una evaluación real se requieren transacciones observadas con permiso y una evaluación nueva sobre datos separados por tiempo.

## Calibración y fuentes públicas

No se incorporaron precios individuales de PROFECO a los registros sintéticos. Todos los precios de SKU son aproximaciones simuladas. El indicador de Soriana de ventas mismas tiendas de -3.6% en 3T26 inspiró una reducción sintética del 3% en la demanda de la matriz durante julio–septiembre de 2026; no se aplicó como tasa real por artículo ni afecta las ventas de las tiendas. Las banderas de eventos son factores de escenario sintéticos. Las semanas tienen límites lunes-domingo; la última semana de datos termina el 15 de noviembre de 2026.

Los valores y referencias incluidos están en indicadores_reales_2026.csv:

- Informe de Soriana 3T2026, publicado el 30 de octubre de 2026: https://www.organizacionsoriana.com/pdf/reportes/2026/3T_2026_Espanol_InfDirVfinal.pdf
- Datos abiertos y catálogo 2026 de PROFECO: https://datos.profeco.gob.mx/
- Historial de precios de PROFECO: https://qqp.profeco.gob.mx/historico
- INEGI EMEC, agosto de 2026: https://en.www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/emec/emec2026_10.pdf
- Crecimiento de ventas de ANTAD, octubre de 2026: https://antad.net/indicadores/crecimiento-nominal-en-ventas/
- Preguntas frecuentes de El Buen Fin 2026: https://www.elbuenfin.org/preguntas-frecuentes

## Campos y unidades

Las ventas son cantidades semanales en la unidad declarada en el catálogo, que varía entre kg, pieza, paquete y otras unidades. Los montos son pesos mexicanos con redondeo a centavos. precio_lista_mxn, descuento_pct y precio_unitario_mxn describen precios; unidades_vendidas es la cantidad objetivo; ingresos_mxn equivale a precio_unitario_mxn por unidades_vendidas; y utilidad_bruta_mxn se calcula con el precio unitario menos costo_unitario_mxn, por las unidades vendidas.

El inventario es simulado y agregado semanalmente: inventario_final equivale a inventario_inicial más reabastecimiento_unidades, menos unidades_vendidas y merma_unidades. No hay eventos de inventario individuales ni identificadores de almacén.

## Importación y reproducibilidad

El importador operativo debe excluir siempre la matriz y cargar solo las cinco tiendas, el catálogo global y el surtido por negocio. El usuario_id=0 y los IDs 1–5 son identificadores sintéticos, no cuentas; no se deben convertir en usuarios de acceso. Si la matriz se necesita para análisis de referencia, cargarla aparte de las tablas operativas y autenticables. Leer los CSV por flujo de filas, no cargarlos completos en memoria.

El generador es un módulo ESM compatible con el type:module de Backend y no requiere dependencias externas. Utiliza una semilla fija para la matriz y semillas independientes por negocio. Desde la raíz del repositorio se ejecuta con node Backend/pulsostock_matriz_soriana_22500_v3/generar_dataset.js; escribe los archivos en su propia carpeta. La prueba se ejecuta con node --test Backend/test/generar_dataset.test.js.
`;
fs.writeFileSync(path.join(OUT,'LEEME_metodologia.md'),doc,'utf8');
console.log(JSON.stringify(sum,null,2));
