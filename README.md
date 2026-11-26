# Proyecto_CalculadoraDeNotas

Calculadora visual que mide cuánto hay que sacar para poder pasar o habilitar una materia, desarrollada en **HTML5, CSS3 y JavaScript** (sin dependencias externas).

## Funcionalidades

- **Plantillas precargadas y modo personalizado:**
  - **Programación (25% / 40% / 35%):** Examen final, talleres y proyecto final.
  - **Matemáticas  (4 × 25% + bonos):** Cuatro exámenes con bonificaciones independientes.
  - **Personalizada:** Agrega o elimina evaluaciones, cambia sus porcentajes, escala máxima y meta.
- **Modificación de variables en tiempo real:**
  - Ajusta nota base, porcentaje y bonificación (`+`) con deslizadores o campos numéricos.
  - Asigna el rol de cada evaluación:
    - **Fija / Obtenida:** Nota ya asegurada.
    - **Variable (Eje X):** Nota que deseas variar para analizar su impacto en la Gráfica 1.
    - **Objetivo (A calcular):** Evaluación cuya nota mínima requerida deseas conocer.
  - Opción para limitar o no la suma de `nota base + bonificación` a la nota máxima.
- **Gráficas interactivas en Canvas (con tooltips al pasar el cursor):**
  1. **Sensibilidad (Variable X vs Objetivo Y):** Muestra la nota mínima requerida en la evaluación objetivo según la nota simulada en la variable X, diferenciando la zona alcanzable de la zona que supera la nota máxima.
  2. **Definitiva resultante:** Curva de la nota definitiva final al variar la nota del objetivo de `0.0` al máximo.
  3. **Aporte ponderado:** Comparación de puntos reales aportados por cada evaluación frente al máximo posible de su porcentaje.

## Estructura del proyecto

```text
Proyecto_CalculadoraDeNotas/
├── index.html          # Página principal (ábrela directamente en tu navegador)
├── README.md           # Documentación del proyecto
└── src/
    ├── styles.css      # Estilos del tablero y diseño responsivo
    ├── calculator.js   # Motor de cálculo puro (ponderaciones, metas y curvas)
    ├── charts.js       # Renderizado de gráficas en Canvas HiDPI y tooltips
    └── app.js          # Estado de la aplicación, plantillas y eventos DOM
```

## Cómo ejecutar

No requiere instalación ni servidor backend. Solo abre `index.html` con doble clic en cualquier navegador moderno (Chrome, Edge, Firefox) o sírvelo localmente si lo prefieres:

```bash
# Opción 1: abrir directamente index.html en el navegador
# Opción 2: servidor local rápido con Python
python -m http.server 8000
```

Luego visita `http://localhost:8000` si usaste el servidor local.
