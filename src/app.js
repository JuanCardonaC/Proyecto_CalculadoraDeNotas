/**
 * Controlador principal de la interfaz de la Calculadora de Notas.
 */
(function () {
    'use strict';

    const PRESETS = {
        materia1: {
            label: 'Materia 1 (Examen / Talleres / Proyecto)',
            maxScale: 5.0,
            goalGrade: 3.0,
            capBonusAtMax: true,
            items: [
                { id: 'm1-t', name: 'Talleres', weight: 40, base: 3.5, bonus: 0.0, role: 'fixed' },
                { id: 'm1-p', name: 'Proyecto Final', weight: 35, base: 4.0, bonus: 0.0, role: 'variable' },
                { id: 'm1-e', name: 'Examen Final', weight: 25, base: 2.0, bonus: 0.0, role: 'target' },
            ],
        },
        discretas: {
            label: 'Matemáticas Discretas (4 × 25% + bonos)',
            maxScale: 5.0,
            goalGrade: 3.0,
            capBonusAtMax: true,
            items: [
                { id: 'md-1', name: 'Examen 1', weight: 25, base: 0.6, bonus: 0.0, role: 'fixed' },
                { id: 'md-2', name: 'Examen 2', weight: 25, base: 2.5, bonus: 0.3, role: 'fixed' },
                { id: 'md-3', name: 'Examen 3', weight: 25, base: 3.25, bonus: 0.3, role: 'variable' },
                { id: 'md-4', name: 'Examen 4', weight: 25, base: 3.0, bonus: 0.0, role: 'target' },
            ],
        },
        libre: {
            label: 'Plantilla libre (3 cortes)',
            maxScale: 5.0,
            goalGrade: 3.0,
            capBonusAtMax: true,
            items: [
                { id: 'l-1', name: 'Corte 1', weight: 30, base: 3.0, bonus: 0.0, role: 'fixed' },
                { id: 'l-2', name: 'Corte 2', weight: 35, base: 3.2, bonus: 0.0, role: 'variable' },
                { id: 'l-3', name: 'Corte 3', weight: 35, base: 3.0, bonus: 0.0, role: 'target' },
            ],
        },
    };

    let state = clonePreset('discretas');
    let activePresetKey = 'discretas';
    let nextIdCounter = 1;

    function clonePreset(key) {
        const src = PRESETS[key] || PRESETS.discretas;
        return {
            maxScale: src.maxScale,
            goalGrade: src.goalGrade,
            capBonusAtMax: src.capBonusAtMax,
            items: src.items.map((it) => ({ ...it })),
        };
    }

    const els = {
        presetBtns: document.querySelectorAll('[data-preset]'),
        goalInput: document.getElementById('goalInput'),
        goalRange: document.getElementById('goalRange'),
        goalQuickBtns: document.querySelectorAll('[data-goal]'),
        maxScaleInput: document.getElementById('maxScaleInput'),
        capBonusCheck: document.getElementById('capBonusCheck'),
        itemsContainer: document.getElementById('itemsContainer'),
        addItemBtn: document.getElementById('addItemBtn'),
        weightWarning: document.getElementById('weightWarning'),
        totalWeightBadge: document.getElementById('totalWeightBadge'),

        cardRequiredValue: document.getElementById('cardRequiredValue'),
        cardRequiredSub: document.getElementById('cardRequiredSub'),
        cardStatusBadge: document.getElementById('cardStatusBadge'),
        cardAccumulatedValue: document.getElementById('cardAccumulatedValue'),
        cardAccumulatedSub: document.getElementById('cardAccumulatedSub'),
        cardProjectedValue: document.getElementById('cardProjectedValue'),
        cardProjectedSub: document.getElementById('cardProjectedSub'),
        cardRangeValue: document.getElementById('cardRangeValue'),
        cardRangeSub: document.getElementById('cardRangeSub'),

        progressFill: document.getElementById('progressFill'),
        progressMarker2: document.getElementById('progressMarker2'),
        progressMarkerGoal: document.getElementById('progressMarkerGoal'),
        progressLabelGoal: document.getElementById('progressLabelGoal'),

        chartSensitivity: document.getElementById('chartSensitivity'),
        tooltipSensitivity: document.getElementById('tooltipSensitivity'),
        chartFinal: document.getElementById('chartFinal'),
        tooltipFinal: document.getElementById('tooltipFinal'),
        chartBreakdown: document.getElementById('chartBreakdown'),
        tooltipBreakdown: document.getElementById('tooltipBreakdown'),
    };

    function syncGlobalInputs() {
        els.goalInput.max = state.maxScale;
        els.goalRange.max = state.maxScale;
        els.goalInput.value = state.goalGrade;
        els.goalRange.value = state.goalGrade;
        els.maxScaleInput.value = state.maxScale;
        els.capBonusCheck.checked = state.capBonusAtMax;

        els.presetBtns.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.preset === activePresetKey);
        });
        els.goalQuickBtns.forEach((btn) => {
            const g = Number(btn.dataset.goal);
            btn.classList.toggle('active', Math.abs(g - state.goalGrade) < 0.01);
        });
    }

    function renderItems() {
        els.itemsContainer.innerHTML = '';

        state.items.forEach((item) => {
            const eff = GradeCalc.getEffectiveGrade(item, state.maxScale, state.capBonusAtMax);
            const row = document.createElement('div');
            row.className = `eval-row role-${item.role}`;
            row.dataset.id = item.id;

            row.innerHTML = `
                <div class="eval-top">
                    <input type="text" class="eval-name" value="${escapeHtml(item.name)}" aria-label="Nombre de evaluación" />
                    <div class="eval-weight-wrap">
                        <input type="number" class="eval-weight" min="0" max="100" step="1" value="${item.weight}" aria-label="Porcentaje" />
                        <span>%</span>
                    </div>
                    <select class="eval-role" aria-label="Rol de evaluación">
                        <option value="fixed" ${item.role === 'fixed' ? 'selected' : ''}>Fija / Obtenida</option>
                        <option value="variable" ${item.role === 'variable' ? 'selected' : ''}>Variable (Eje X)</option>
                        <option value="target" ${item.role === 'target' ? 'selected' : ''}>Objetivo (A calcular)</option>
                    </select>
                    <button type="button" class="btn-icon delete-btn" title="Eliminar evaluación" ${state.items.length <= 1 ? 'disabled' : ''}>✕</button>
                </div>

                <div class="eval-sliders">
                    <div class="slider-group">
                        <div class="slider-header">
                            <label>${item.role === 'target' ? 'Nota simulada (para gráfica 2)' : 'Nota base'}</label>
                            <span class="eff-pill">Efectiva: <strong>${eff.toFixed(2)}</strong></span>
                        </div>
                        <div class="slider-controls">
                            <input type="range" class="eval-base-range" min="0" max="${state.maxScale}" step="0.05" value="${item.base}" />
                            <input type="number" class="eval-base-num" min="0" max="${state.maxScale}" step="0.05" value="${item.base}" />
                        </div>
                    </div>

                    <div class="slider-group bonus-group">
                        <div class="slider-header">
                            <label>Bonificación (+)</label>
                            <span class="muted-hint">Aporte: ${((eff * item.weight) / 100).toFixed(2)} pts</span>
                        </div>
                        <div class="slider-controls">
                            <input type="range" class="eval-bonus-range" min="0" max="1.5" step="0.05" value="${item.bonus}" />
                            <input type="number" class="eval-bonus-num" min="0" max="2" step="0.05" value="${item.bonus}" />
                        </div>
                    </div>
                </div>
            `;

            const nameEl = row.querySelector('.eval-name');
            const weightEl = row.querySelector('.eval-weight');
            const roleEl = row.querySelector('.eval-role');
            const deleteEl = row.querySelector('.delete-btn');
            const baseRange = row.querySelector('.eval-base-range');
            const baseNum = row.querySelector('.eval-base-num');
            const bonusRange = row.querySelector('.eval-bonus-range');
            const bonusNum = row.querySelector('.eval-bonus-num');
            const effPill = row.querySelector('.eff-pill strong');
            const ptsHint = row.querySelector('.muted-hint');

            const refreshRowDisplay = () => {
                const updatedEff = GradeCalc.getEffectiveGrade(item, state.maxScale, state.capBonusAtMax);
                effPill.textContent = updatedEff.toFixed(2);
                ptsHint.textContent = `Aporte: ${((updatedEff * item.weight) / 100).toFixed(2)} pts`;
            };

            nameEl.addEventListener('input', () => {
                item.name = nameEl.value || 'Evaluación';
                updateCalculationsAndCharts();
            });

            weightEl.addEventListener('input', () => {
                item.weight = Math.max(0, Number(weightEl.value) || 0);
                refreshRowDisplay();
                updateCalculationsAndCharts();
            });

            roleEl.addEventListener('change', () => {
                const newRole = roleEl.value;
                if (newRole === 'target' || newRole === 'variable') {
                    state.items.forEach((other) => {
                        if (other.id !== item.id && other.role === newRole) {
                            other.role = 'fixed';
                        }
                    });
                }
                item.role = newRole;
                renderItems();
                updateCalculationsAndCharts();
            });

            const updateBase = (val) => {
                item.base = GradeCalc.clamp(Number(val), 0, state.maxScale);
                baseRange.value = item.base;
                baseNum.value = item.base;
                refreshRowDisplay();
                updateCalculationsAndCharts();
            };
            baseRange.addEventListener('input', (e) => updateBase(e.target.value));
            baseNum.addEventListener('input', (e) => updateBase(e.target.value));

            const updateBonus = (val) => {
                item.bonus = Math.max(0, Number(val) || 0);
                bonusRange.value = Math.min(1.5, item.bonus);
                bonusNum.value = item.bonus;
                refreshRowDisplay();
                updateCalculationsAndCharts();
            };
            bonusRange.addEventListener('input', (e) => updateBonus(e.target.value));
            bonusNum.addEventListener('input', (e) => updateBonus(e.target.value));

            deleteEl.addEventListener('click', () => {
                if (state.items.length <= 1) return;
                state.items = state.items.filter((it) => it.id !== item.id);
                renderItems();
                updateCalculationsAndCharts();
            });

            els.itemsContainer.appendChild(row);
        });
    }

    function updateCalculationsAndCharts() {
        const summary = GradeCalc.computeSummary(
            state.items,
            state.goalGrade,
            state.maxScale,
            state.capBonusAtMax
        );

        // Validar suma de porcentajes
        const wSum = Math.round(summary.totalWeight * 100) / 100;
        els.totalWeightBadge.textContent = `Total: ${wSum}%`;
        if (Math.abs(wSum - 100) > 0.01) {
            els.totalWeightBadge.classList.add('warn');
            els.weightWarning.style.display = 'block';
            els.weightWarning.textContent = `La suma de porcentajes es ${wSum}% (debería ser 100% para representar la nota completa).`;
        } else {
            els.totalWeightBadge.classList.remove('warn');
            els.weightWarning.style.display = 'none';
        }

        // Tarjeta 1: Nota necesaria en el objetivo
        els.cardStatusBadge.className = 'status-badge';
        if (summary.status === 'no-target') {
            els.cardRequiredValue.textContent = '—';
            els.cardRequiredSub.textContent = 'Marca una evaluación como "Objetivo (A calcular)".';
            els.cardStatusBadge.textContent = 'Sin objetivo';
            els.cardStatusBadge.classList.add('badge-muted');
        } else if (summary.status === 'already-passed') {
            els.cardRequiredValue.textContent = '0.00';
            els.cardRequiredSub.textContent = `Ya alcanzaste ${state.goalGrade.toFixed(1)} sin necesidad de puntos extra en "${summary.targetItem.name}".`;
            els.cardStatusBadge.textContent = '¡Ya cumplida!';
            els.cardStatusBadge.classList.add('badge-success');
        } else if (summary.status === 'achievable') {
            els.cardRequiredValue.textContent = summary.requiredBase.toFixed(2);
            const bonusNote =
                summary.targetItem.bonus > 0
                    ? ` (efectiva ${summary.requiredEffective.toFixed(2)} con bono +${summary.targetItem.bonus.toFixed(2)})`
                    : '';
            els.cardRequiredSub.textContent = `Mínimo en "${summary.targetItem.name}" (${summary.targetItem.weight}%)${bonusNote} para llegar a ${state.goalGrade.toFixed(2)}.`;
            els.cardStatusBadge.textContent = 'Alcanzable';
            els.cardStatusBadge.classList.add('badge-primary');
        } else {
            els.cardRequiredValue.textContent = summary.requiredBase.toFixed(2);
            els.cardRequiredSub.textContent = `Supera el máximo (${state.maxScale.toFixed(1)}). Con ${state.maxScale.toFixed(1)} llegarías a ${summary.maxPossibleFinal.toFixed(2)}.`;
            els.cardStatusBadge.textContent = 'No alcanza (> máx)';
            els.cardStatusBadge.classList.add('badge-danger');
        }

        // Tarjeta 2: Puntos acumulados sin el objetivo
        els.cardAccumulatedValue.textContent = `${summary.accumulatedPoints.toFixed(2)} pts`;
        const missing = Math.max(0, state.goalGrade - summary.accumulatedPoints);
        els.cardAccumulatedSub.textContent =
            missing > 0
                ? `Te faltan ${missing.toFixed(2)} pts para llegar a ${state.goalGrade.toFixed(2)}.`
                : `Ya superaste la meta de ${state.goalGrade.toFixed(2)} con tus otras notas.`;

        // Tarjeta 3: Definitiva proyectada con la nota simulada actual
        els.cardProjectedValue.textContent = summary.projectedFinal.toFixed(2);
        els.cardProjectedSub.textContent = summary.targetItem
            ? `Si sacas ${summary.targetItem.base.toFixed(2)} en "${summary.targetItem.name}".`
            : 'Suma ponderada actual.';

        // Tarjeta 4: Rango posible
        els.cardRangeValue.textContent = `${summary.minPossibleFinal.toFixed(2)} – ${summary.maxPossibleFinal.toFixed(2)}`;
        els.cardRangeSub.textContent = summary.targetItem
            ? `Mínimo y máximo posible según "${summary.targetItem.name}".`
            : 'Rango con tu configuración actual.';

        // Barra de progreso de definitiva proyectada
        const pct = Math.min(100, Math.max(0, (summary.projectedFinal / state.maxScale) * 100));
        els.progressFill.style.width = `${pct}%`;
        els.progressFill.className = 'progress-fill';
        if (summary.projectedFinal >= state.goalGrade) {
            els.progressFill.classList.add('fill-success');
        } else if (summary.projectedFinal >= 2.0) {
            els.progressFill.classList.add('fill-warning');
        } else {
            els.progressFill.classList.add('fill-danger');
        }

        if (state.maxScale >= 2.0) {
            els.progressMarker2.style.display = 'block';
            els.progressMarker2.style.left = `${(2.0 / state.maxScale) * 100}%`;
        } else {
            els.progressMarker2.style.display = 'none';
        }
        const goalPct = Math.min(100, Math.max(0, (state.goalGrade / state.maxScale) * 100));
        els.progressMarkerGoal.style.left = `${goalPct}%`;
        els.progressLabelGoal.textContent = `Meta ${state.goalGrade.toFixed(1)}`;

        // Gráfica 1: Curva de sensibilidad
        const curve = GradeCalc.buildSensitivityCurve(
            state.items,
            state.goalGrade,
            state.maxScale,
            state.capBonusAtMax,
            60
        );
        const secondaryGoal =
            Math.abs(state.goalGrade - 2.0) > 0.05 && state.maxScale >= 2.0
                ? 2.0
                : Math.abs(state.goalGrade - 3.0) > 0.05 && state.maxScale >= 3.0
                  ? 3.0
                  : null;
        const secondaryCurve =
            secondaryGoal !== null
                ? GradeCalc.buildSensitivityCurve(
                      state.items,
                      secondaryGoal,
                      state.maxScale,
                      state.capBonusAtMax,
                      60
                  )
                : null;

        GradeCharts.drawSensitivityChart(els.chartSensitivity, els.tooltipSensitivity, {
            curve,
            secondaryCurve,
            goalGrade: state.goalGrade,
            secondaryGoal,
            maxScale: state.maxScale,
            variableItem: summary.variableItem,
            targetItem: summary.targetItem,
            currentX: summary.variableItem ? summary.variableItem.base : 0,
            currentY: summary.requiredBase !== null ? summary.requiredBase : 0,
        });

        // Gráfica 2: Curva de definitiva resultante
        const finalCurve = GradeCalc.buildFinalGradeCurve(
            state.items,
            state.maxScale,
            state.capBonusAtMax,
            60
        );
        GradeCharts.drawFinalCurveChart(els.chartFinal, els.tooltipFinal, {
            curve: finalCurve,
            goalGrade: state.goalGrade,
            maxScale: state.maxScale,
            targetItem: summary.targetItem,
            currentTargetBase: summary.targetItem ? summary.targetItem.base : 0,
            projectedFinal: summary.projectedFinal,
        });

        // Gráfica 3: Desglose de aportes
        GradeCharts.drawBreakdownChart(els.chartBreakdown, els.tooltipBreakdown, {
            breakdown: summary.breakdown,
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Eventos globales
    els.presetBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            activePresetKey = btn.dataset.preset;
            state = clonePreset(activePresetKey);
            syncGlobalInputs();
            renderItems();
            updateCalculationsAndCharts();
        });
    });

    const updateGoal = (val) => {
        state.goalGrade = GradeCalc.clamp(Number(val), 0, state.maxScale);
        syncGlobalInputs();
        updateCalculationsAndCharts();
    };
    els.goalInput.addEventListener('input', (e) => updateGoal(e.target.value));
    els.goalRange.addEventListener('input', (e) => updateGoal(e.target.value));
    els.goalQuickBtns.forEach((btn) => {
        btn.addEventListener('click', () => updateGoal(btn.dataset.goal));
    });

    els.maxScaleInput.addEventListener('change', (e) => {
        const val = Math.max(1, Number(e.target.value) || 5);
        state.maxScale = val;
        state.goalGrade = GradeCalc.clamp(state.goalGrade, 0, val);
        state.items.forEach((it) => {
            it.base = GradeCalc.clamp(it.base, 0, val);
        });
        syncGlobalInputs();
        renderItems();
        updateCalculationsAndCharts();
    });

    els.capBonusCheck.addEventListener('change', (e) => {
        state.capBonusAtMax = e.target.checked;
        renderItems();
        updateCalculationsAndCharts();
    });

    els.addItemBtn.addEventListener('click', () => {
        const hasTarget = state.items.some((it) => it.role === 'target');
        const hasVar = state.items.some((it) => it.role === 'variable');
        const role = !hasTarget ? 'target' : !hasVar ? 'variable' : 'fixed';
        state.items.push({
            id: `custom-${nextIdCounter++}`,
            name: `Evaluación ${state.items.length + 1}`,
            weight: 10,
            base: 3.0,
            bonus: 0.0,
            role,
        });
        renderItems();
        updateCalculationsAndCharts();
    });

    GradeCharts.attachCanvasEvents(els.chartSensitivity, els.tooltipSensitivity);
    GradeCharts.attachCanvasEvents(els.chartFinal, els.tooltipFinal);
    GradeCharts.attachCanvasEvents(els.chartBreakdown, els.tooltipBreakdown);

    window.addEventListener('resize', () => {
        updateCalculationsAndCharts();
    });

    // Inicializar
    syncGlobalInputs();
    renderItems();
    updateCalculationsAndCharts();
})();
