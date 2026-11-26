/**
 * Renderizado de gráficas interactivas en HTML5 Canvas con soporte HiDPI y tooltips.
 */
(function (global) {
    'use strict';

    const PALETTE = {
        bg: '#0f172a',
        grid: 'rgba(148, 163, 184, 0.14)',
        axis: 'rgba(148, 163, 184, 0.45)',
        text: '#cbd5e1',
        muted: '#94a3b8',
        primary: '#38bdf8',
        secondary: '#a78bfa',
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#fb7185',
        viableBg: 'rgba(52, 211, 153, 0.08)',
        impossibleBg: 'rgba(251, 113, 133, 0.10)',
    };

    /**
     * Ajusta el canvas al tamaño visual con devicePixelRatio para nitidez Retina/HiDPI.
     * @param {HTMLCanvasElement} canvas
     */
    function prepareCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(280, Math.floor(rect.width));
        const height = Math.max(220, Math.floor(rect.height));

        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        }

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        return { ctx, width, height };
    }

    function drawEmptyMessage(ctx, width, height, message) {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = '14px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(message, width / 2, height / 2);
    }

    /**
     * Posiciona un tooltip flotante cerca del cursor dentro del contenedor.
     */
    function showTooltip(tooltipEl, canvas, clientX, clientY, html) {
        if (!tooltipEl) return;
        const parentRect = canvas.parentElement.getBoundingClientRect();
        const x = clientX - parentRect.left;
        const y = clientY - parentRect.top;

        tooltipEl.innerHTML = html;
        tooltipEl.style.display = 'block';

        const tipRect = tooltipEl.getBoundingClientRect();
        let left = x + 14;
        let top = y - tipRect.height - 10;

        if (left + tipRect.width > parentRect.width - 8) {
            left = x - tipRect.width - 14;
        }
        if (top < 8) {
            top = y + 14;
        }

        tooltipEl.style.left = `${Math.max(8, left)}px`;
        tooltipEl.style.top = `${Math.max(8, top)}px`;
    }

    function hideTooltip(tooltipEl) {
        if (tooltipEl) tooltipEl.style.display = 'none';
    }

    /**
     * Gráfica 1: Nota necesaria en el objetivo (Y) vs nota simulada de la variable (X).
     */
    function drawSensitivityChart(canvas, tooltipEl, state) {
        const { ctx, width, height } = prepareCanvas(canvas);
        const {
            curve,
            secondaryCurve,
            goalGrade,
            secondaryGoal,
            maxScale,
            variableItem,
            targetItem,
            currentX,
            currentY,
        } = state;

        if (!variableItem || !targetItem || !curve.length) {
            drawEmptyMessage(
                ctx,
                width,
                height,
                'Asigna una evaluación como "Variable (Eje X)" y otra como "Objetivo" para ver esta gráfica.'
            );
            canvas._hoverHandler = null;
            return;
        }

        const pad = { top: 24, right: 24, bottom: 44, left: 54 };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;

        // Rango Y dinámico con margen cómodo, mínimo [0, maxScale + 1]
        const yValues = curve.map((p) => p.yRequiredBase);
        const maxCurveY = Math.max(...yValues, maxScale + 0.5);
        const minCurveY = Math.min(...yValues, 0);
        const yMin = Math.min(0, Math.floor(minCurveY * 2) / 2);
        const yMax = Math.min(maxScale * 1.6, Math.max(maxScale + 1, Math.ceil(maxCurveY * 2) / 2));

        const xToPx = (x) => pad.left + (x / maxScale) * plotW;
        const yToPx = (y) => {
            const clamped = Math.max(yMin, Math.min(yMax, y));
            return pad.top + ((yMax - clamped) / (yMax - yMin)) * plotH;
        };

        // Zonas viable (>0 y <= maxScale) vs imposible (> maxScale)
        const yMaxScalePx = yToPx(maxScale);
        const yZeroPx = yToPx(0);
        const yTopPx = pad.top;
        const yBottomPx = pad.top + plotH;

        ctx.fillStyle = PALETTE.impossibleBg;
        ctx.fillRect(pad.left, yTopPx, plotW, Math.max(0, yMaxScalePx - yTopPx));

        ctx.fillStyle = PALETTE.viableBg;
        ctx.fillRect(pad.left, yMaxScalePx, plotW, Math.max(0, yZeroPx - yMaxScalePx));

        // Grilla Y
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const yStep = yMax - yMin > 6 ? 1 : 0.5;
        for (let yVal = Math.ceil(yMin / yStep) * yStep; yVal <= yMax + 0.001; yVal += yStep) {
            const py = yToPx(yVal);
            ctx.strokeStyle =
                Math.abs(yVal - maxScale) < 0.01
                    ? 'rgba(251, 113, 133, 0.7)'
                    : Math.abs(yVal) < 0.01
                      ? 'rgba(52, 211, 153, 0.55)'
                      : PALETTE.grid;
            ctx.lineWidth = Math.abs(yVal - maxScale) < 0.01 ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(pad.left, py);
            ctx.lineTo(pad.left + plotW, py);
            ctx.stroke();

            ctx.fillStyle =
                Math.abs(yVal - maxScale) < 0.01 ? PALETTE.danger : PALETTE.muted;
            ctx.fillText(yVal.toFixed(1), pad.left - 8, py);
        }

        // Grilla X
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let xVal = 0; xVal <= maxScale + 0.001; xVal += 0.5) {
            const px = xToPx(xVal);
            ctx.strokeStyle = PALETTE.grid;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, pad.top);
            ctx.lineTo(px, yBottomPx);
            ctx.stroke();

            if (Math.abs(xVal % 1) < 0.01 || maxScale <= 5) {
                ctx.fillStyle = PALETTE.muted;
                ctx.fillText(xVal.toFixed(1), px, yBottomPx + 8);
            }
        }

        // Ejes principales
        ctx.strokeStyle = PALETTE.axis;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top);
        ctx.lineTo(pad.left, yBottomPx);
        ctx.lineTo(pad.left + plotW, yBottomPx);
        ctx.stroke();

        // Etiqueta límite máximo
        ctx.fillStyle = PALETTE.danger;
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Límite máx (${maxScale.toFixed(1)}) — Arriba es imposible`, pad.left + 8, yMaxScalePx - 4);

        // Curva secundaria (ej. meta 2.0)
        if (secondaryCurve && secondaryCurve.length) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(pad.left, pad.top, plotW, plotH);
            ctx.clip();
            ctx.strokeStyle = PALETTE.secondary;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            secondaryCurve.forEach((pt, idx) => {
                const px = xToPx(pt.x);
                const py = yToPx(pt.yRequiredBase);
                if (idx === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.stroke();
            ctx.restore();
        }

        // Curva principal (meta principal)
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad.left, pad.top, plotW, plotH);
        ctx.clip();
        ctx.strokeStyle = PALETTE.primary;
        ctx.lineWidth = 3;
        ctx.beginPath();
        curve.forEach((pt, idx) => {
            const px = xToPx(pt.x);
            const py = yToPx(pt.yRequiredBase);
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();

        // Punto actual
        const curPx = xToPx(currentX);
        const curPy = yToPx(currentY);
        const dotColor =
            currentY <= 0
                ? PALETTE.success
                : currentY <= maxScale
                  ? PALETTE.primary
                  : PALETTE.danger;

        // Guías punteadas al punto actual
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(curPx, yBottomPx);
        ctx.lineTo(curPx, curPy);
        ctx.lineTo(pad.left, curPy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(curPx, curPy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Títulos de ejes
        ctx.fillStyle = PALETTE.text;
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Nota base en "${variableItem.name}"`, pad.left + plotW / 2, height - 4);

        ctx.save();
        ctx.translate(14, pad.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`Necesitas en "${targetItem.name}"`, 0, 0);
        ctx.restore();

        // Leyenda superior derecha
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillStyle = PALETTE.primary;
        ctx.fillText(`━ Meta ${goalGrade.toFixed(1)}`, pad.left + plotW, 6);
        if (secondaryGoal !== null) {
            ctx.fillStyle = PALETTE.secondary;
            ctx.fillText(`┄ Meta ${secondaryGoal.toFixed(1)}`, pad.left + plotW - 78, 6);
        }

        // Interacción hover
        canvas._hoverHandler = (ev) => {
            const rect = canvas.getBoundingClientRect();
            const mx = ev.clientX - rect.left;
            const my = ev.clientY - rect.top;
            if (mx < pad.left || mx > pad.left + plotW || my < pad.top || my > yBottomPx) {
                hideTooltip(tooltipEl);
                return;
            }
            const xVal = ((mx - pad.left) / plotW) * maxScale;
            let nearest = curve[0];
            let bestDist = Infinity;
            for (const pt of curve) {
                const d = Math.abs(pt.x - xVal);
                if (d < bestDist) {
                    bestDist = d;
                    nearest = pt;
                }
            }
            const secPt = secondaryCurve
                ? secondaryCurve.find((p) => Math.abs(p.x - nearest.x) < 0.001)
                : null;

            const reqText =
                nearest.yRequiredBase <= 0
                    ? `<span style="color:${PALETTE.success}">0.00 (ya pasas)</span>`
                    : nearest.yRequiredBase <= maxScale
                      ? `<span style="color:${PALETTE.primary}">${nearest.yRequiredBase.toFixed(2)}</span>`
                      : `<span style="color:${PALETTE.danger}">${nearest.yRequiredBase.toFixed(2)} (imposible)</span>`;

            let html = `<div><strong>${variableItem.name}:</strong> ${nearest.x.toFixed(2)}</div>`;
            html += `<div><strong>Para ${goalGrade.toFixed(1)} necesitas:</strong> ${reqText}</div>`;
            if (secPt) {
                const secText =
                    secPt.yRequiredBase <= 0
                        ? '0.00'
                        : `${secPt.yRequiredBase.toFixed(2)}`;
                html += `<div><strong>Para ${secondaryGoal.toFixed(1)} necesitas:</strong> ${secText}</div>`;
            }
            showTooltip(tooltipEl, canvas, ev.clientX, ev.clientY, html);
        };
    }

    /**
     * Gráfica 2: Nota definitiva resultante (Y) según la nota del examen objetivo (X).
     */
    function drawFinalCurveChart(canvas, tooltipEl, state) {
        const { ctx, width, height } = prepareCanvas(canvas);
        const { curve, goalGrade, maxScale, targetItem, currentTargetBase, projectedFinal } = state;

        if (!targetItem || !curve.length) {
            drawEmptyMessage(
                ctx,
                width,
                height,
                'Selecciona una evaluación como "Objetivo" para simular su impacto.'
            );
            canvas._hoverHandler = null;
            return;
        }

        const pad = { top: 24, right: 24, bottom: 44, left: 54 };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;

        const xToPx = (x) => pad.left + (x / maxScale) * plotW;
        const yToPx = (y) => pad.top + ((maxScale - Math.min(maxScale, Math.max(0, y))) / maxScale) * plotH;
        const yBottomPx = pad.top + plotH;

        // Fondo de referencia arriba de goalGrade
        const goalPx = yToPx(goalGrade);
        ctx.fillStyle = PALETTE.viableBg;
        ctx.fillRect(pad.left, pad.top, plotW, goalPx - pad.top);

        // Grilla Y
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let yVal = 0; yVal <= maxScale + 0.001; yVal += 0.5) {
            const py = yToPx(yVal);
            ctx.strokeStyle = PALETTE.grid;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad.left, py);
            ctx.lineTo(pad.left + plotW, py);
            ctx.stroke();

            if (Math.abs(yVal % 1) < 0.01) {
                ctx.fillStyle = PALETTE.muted;
                ctx.fillText(yVal.toFixed(1), pad.left - 8, py);
            }
        }

        // Grilla X
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let xVal = 0; xVal <= maxScale + 0.001; xVal += 0.5) {
            const px = xToPx(xVal);
            ctx.strokeStyle = PALETTE.grid;
            ctx.beginPath();
            ctx.moveTo(px, pad.top);
            ctx.lineTo(px, yBottomPx);
            ctx.stroke();

            if (Math.abs(xVal % 1) < 0.01) {
                ctx.fillStyle = PALETTE.muted;
                ctx.fillText(xVal.toFixed(1), px, yBottomPx + 8);
            }
        }

        // Líneas de referencia: Meta principal y 2.0 (Habilitar)
        const refLines = [
            { val: goalGrade, color: PALETTE.success, label: `Meta (${goalGrade.toFixed(1)})` },
        ];
        if (Math.abs(goalGrade - 2.0) > 0.05 && maxScale >= 2.0) {
            refLines.push({ val: 2.0, color: PALETTE.warning, label: 'Habilita (2.0)' });
        }
        refLines.forEach((ref) => {
            const py = yToPx(ref.val);
            ctx.strokeStyle = ref.color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(pad.left, py);
            ctx.lineTo(pad.left + plotW, py);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = ref.color;
            ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(ref.label, pad.left + 6, py - 3);
        });

        // Ejes
        ctx.strokeStyle = PALETTE.axis;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top);
        ctx.lineTo(pad.left, yBottomPx);
        ctx.lineTo(pad.left + plotW, yBottomPx);
        ctx.stroke();

        // Curva definitiva
        ctx.strokeStyle = PALETTE.primary;
        ctx.lineWidth = 3;
        ctx.beginPath();
        curve.forEach((pt, idx) => {
            const px = xToPx(pt.x);
            const py = yToPx(pt.finalGrade);
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Punto simulado actual
        const curPx = xToPx(currentTargetBase);
        const curPy = yToPx(projectedFinal);
        ctx.fillStyle = projectedFinal >= goalGrade ? PALETTE.success : PALETTE.warning;
        ctx.beginPath();
        ctx.arc(curPx, curPy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Títulos de ejes
        ctx.fillStyle = PALETTE.text;
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Nota en "${targetItem.name}"`, pad.left + plotW / 2, height - 4);

        ctx.save();
        ctx.translate(14, pad.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Nota definitiva final', 0, 0);
        ctx.restore();

        canvas._hoverHandler = (ev) => {
            const rect = canvas.getBoundingClientRect();
            const mx = ev.clientX - rect.left;
            const my = ev.clientY - rect.top;
            if (mx < pad.left || mx > pad.left + plotW || my < pad.top || my > yBottomPx) {
                hideTooltip(tooltipEl);
                return;
            }
            const xVal = ((mx - pad.left) / plotW) * maxScale;
            let nearest = curve[0];
            let bestDist = Infinity;
            for (const pt of curve) {
                const d = Math.abs(pt.x - xVal);
                if (d < bestDist) {
                    bestDist = d;
                    nearest = pt;
                }
            }
            const color = nearest.finalGrade >= goalGrade ? PALETTE.success : PALETTE.warning;
            const html =
                `<div><strong>${targetItem.name}:</strong> ${nearest.x.toFixed(2)}</div>` +
                `<div><strong>Definitiva:</strong> <span style="color:${color}">${nearest.finalGrade.toFixed(2)}</span></div>`;
            showTooltip(tooltipEl, canvas, ev.clientX, ev.clientY, html);
        };
    }

    /**
     * Gráfica 3: Aporte ponderado de cada evaluación (puntos ganados vs máximo de esa evaluación).
     */
    function drawBreakdownChart(canvas, tooltipEl, state) {
        const { ctx, width, height } = prepareCanvas(canvas);
        const { breakdown } = state;

        if (!breakdown || !breakdown.length) {
            drawEmptyMessage(ctx, width, height, 'Agrega evaluaciones para ver su aporte ponderado.');
            canvas._hoverHandler = null;
            return;
        }

        const pad = { top: 20, right: 24, bottom: 32, left: 130 };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;

        const maxBarPoints = Math.max(...breakdown.map((b) => b.maxPoints), 0.5);
        const rowH = plotH / breakdown.length;
        const barH = Math.min(28, rowH * 0.56);

        const barsMeta = [];

        breakdown.forEach((item, idx) => {
            const cy = pad.top + rowH * idx + rowH / 2;
            const by = cy - barH / 2;
            const maxW = (item.maxPoints / maxBarPoints) * plotW;
            const valW = Math.min(maxW, (item.points / maxBarPoints) * plotW);

            // Nombre a la izquierda
            ctx.fillStyle = PALETTE.text;
            ctx.font = '12px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const label = `${item.name} (${item.weight}%)`;
            ctx.fillText(label.length > 19 ? label.slice(0, 18) + '…' : label, pad.left - 10, cy);

            // Fondo máximo posible
            ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
            ctx.beginPath();
            ctx.roundRect(pad.left, by, maxW, barH, 6);
            ctx.fill();

            // Barra de aporte actual
            let barColor = PALETTE.primary;
            if (item.role === 'target') barColor = PALETTE.warning;
            else if (item.role === 'variable') barColor = PALETTE.secondary;
            else barColor = PALETTE.success;

            if (valW > 0) {
                ctx.fillStyle = barColor;
                ctx.beginPath();
                ctx.roundRect(pad.left, by, valW, barH, 6);
                ctx.fill();
            }

            // Texto al final de la barra
            ctx.fillStyle = PALETTE.text;
            ctx.font = '11px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(
                `${item.points.toFixed(2)} / ${item.maxPoints.toFixed(2)} pts`,
                pad.left + Math.max(valW, 0) + 8 > pad.left + maxW - 70
                    ? pad.left + maxW + 8
                    : pad.left + valW + 8,
                cy
            );

            barsMeta.push({ by, barH, item });
        });

        // Leyenda inferior
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const itemsLegend = [
            { label: '■ Fija', color: PALETTE.success },
            { label: '■ Variable X', color: PALETTE.secondary },
            { label: '■ Objetivo (simulada)', color: PALETTE.warning },
        ];
        let lx = pad.left;
        itemsLegend.forEach((leg) => {
            ctx.fillStyle = leg.color;
            ctx.fillText(leg.label, lx, height - 6);
            lx += ctx.measureText(leg.label).width + 18;
        });

        canvas._hoverHandler = (ev) => {
            const rect = canvas.getBoundingClientRect();
            const my = ev.clientY - rect.top;
            const hit = barsMeta.find((b) => my >= b.by && my <= b.by + b.barH);
            if (!hit) {
                hideTooltip(tooltipEl);
                return;
            }
            const it = hit.item;
            const html =
                `<div><strong>${it.name} (${it.weight}%)</strong></div>` +
                `<div>Nota efectiva: ${it.effective.toFixed(2)} (base ${it.base.toFixed(2)} + bono ${it.bonus.toFixed(2)})</div>` +
                `<div>Aporte: <strong>${it.points.toFixed(2)}</strong> de ${it.maxPoints.toFixed(2)} pts</div>`;
            showTooltip(tooltipEl, canvas, ev.clientX, ev.clientY, html);
        };
    }

    /**
     * Registra eventos de mouse en los canvas para tooltips fluidos.
     */
    function attachCanvasEvents(canvas, tooltipEl) {
        canvas.addEventListener('mousemove', (ev) => {
            if (typeof canvas._hoverHandler === 'function') {
                canvas._hoverHandler(ev);
            }
        });
        canvas.addEventListener('mouseleave', () => hideTooltip(tooltipEl));
    }

    global.GradeCharts = {
        drawSensitivityChart,
        drawFinalCurveChart,
        drawBreakdownChart,
        attachCanvasEvents,
    };
})(window);
