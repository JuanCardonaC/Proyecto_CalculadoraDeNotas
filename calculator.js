/**
 * Motor de cálculo académico para simulación de notas y metas.
 * Todas las funciones son puras para facilitar pruebas y reutilización.
 */
(function (global) {
    'use strict';

    /**
     * Limita un número al rango [min, max].
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    function clamp(value, min, max) {
        if (Number.isNaN(value)) return min;
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Calcula la nota efectiva de una evaluación sumando su bonificación.
     * @param {{ base: number, bonus: number }} item
     * @param {number} maxScale
     * @param {boolean} capBonusAtMax
     * @returns {number}
     */
    function getEffectiveGrade(item, maxScale, capBonusAtMax) {
        const base = Number(item.base) || 0;
        const bonus = Number(item.bonus) || 0;
        const sum = base + bonus;
        if (capBonusAtMax) {
            return clamp(sum, 0, maxScale);
        }
        return Math.max(0, sum);
    }

    /**
     * Calcula la nota necesaria en la evaluación objetivo para alcanzar `goalGrade`.
     * @param {Array} items
     * @param {number} goalGrade
     * @param {number} maxScale
     * @param {boolean} capBonusAtMax
     * @returns {object}
     */
    function computeSummary(items, goalGrade, maxScale, capBonusAtMax) {
        const totalWeight = items.reduce((acc, it) => acc + (Number(it.weight) || 0), 0);
        const targetItem = items.find((it) => it.role === 'target') || null;
        const variableItem = items.find((it) => it.role === 'variable') || null;

        let accumulatedPoints = 0;
        const breakdown = items.map((it) => {
            const weightRatio = (Number(it.weight) || 0) / 100;
            const effective = getEffectiveGrade(it, maxScale, capBonusAtMax);
            const points = effective * weightRatio;

            if (!targetItem || it.id !== targetItem.id) {
                accumulatedPoints += points;
            }

            return {
                id: it.id,
                name: it.name,
                weight: Number(it.weight) || 0,
                role: it.role,
                base: Number(it.base) || 0,
                bonus: Number(it.bonus) || 0,
                effective,
                points,
                maxPoints: maxScale * weightRatio,
            };
        });

        const targetWeight = targetItem ? Number(targetItem.weight) || 0 : 0;
        const targetWeightRatio = targetWeight / 100;
        const targetBonus = targetItem ? Number(targetItem.bonus) || 0 : 0;

        let requiredEffective = null;
        let requiredBase = null;
        let status = 'no-target';

        if (targetItem && targetWeightRatio > 0) {
            const missingPoints = goalGrade - accumulatedPoints;
            requiredEffective = missingPoints / targetWeightRatio;
            requiredBase = requiredEffective - targetBonus;

            if (requiredBase <= 0) {
                status = 'already-passed';
            } else if (requiredBase <= maxScale) {
                status = 'achievable';
            } else {
                status = 'impossible';
            }
        }

        const currentTargetEffective = targetItem
            ? getEffectiveGrade(targetItem, maxScale, capBonusAtMax)
            : 0;
        const projectedFinal =
            accumulatedPoints + (targetItem ? currentTargetEffective * targetWeightRatio : 0);

        const maxPossibleFinal =
            accumulatedPoints +
            (targetItem
                ? getEffectiveGrade(
                      { base: maxScale, bonus: targetBonus },
                      maxScale,
                      capBonusAtMax
                  ) * targetWeightRatio
                : 0);

        const minPossibleFinal =
            accumulatedPoints +
            (targetItem
                ? getEffectiveGrade({ base: 0, bonus: targetBonus }, maxScale, capBonusAtMax) *
                  targetWeightRatio
                : 0);

        return {
            totalWeight,
            targetItem,
            variableItem,
            accumulatedPoints,
            requiredEffective,
            requiredBase,
            status,
            projectedFinal,
            maxPossibleFinal,
            minPossibleFinal,
            breakdown,
        };
    }

    /**
     * Genera los puntos (X, Y) para la gráfica 1:
     * X = nota base de la variable elegida (0..maxScale)
     * Y = nota base mínima necesaria en la evaluación objetivo para alcanzar `goalGrade`.
     * @param {Array} items
     * @param {number} goalGrade
     * @param {number} maxScale
     * @param {boolean} capBonusAtMax
     * @param {number} steps
     * @returns {Array<{x: number, xEffective: number, yRequiredBase: number}>}
     */
    function buildSensitivityCurve(items, goalGrade, maxScale, capBonusAtMax, steps) {
        const targetItem = items.find((it) => it.role === 'target');
        const variableItem = items.find((it) => it.role === 'variable');
        if (!targetItem || !variableItem || (Number(targetItem.weight) || 0) <= 0) {
            return [];
        }

        const fixedPoints = items.reduce((acc, it) => {
            if (it.id === targetItem.id || it.id === variableItem.id) return acc;
            const w = (Number(it.weight) || 0) / 100;
            return acc + getEffectiveGrade(it, maxScale, capBonusAtMax) * w;
        }, 0);

        const varWeight = (Number(variableItem.weight) || 0) / 100;
        const varBonus = Number(variableItem.bonus) || 0;
        const targetWeight = (Number(targetItem.weight) || 0) / 100;
        const targetBonus = Number(targetItem.bonus) || 0;

        const points = [];
        const totalSteps = steps || 50;
        for (let i = 0; i <= totalSteps; i++) {
            const x = (maxScale * i) / totalSteps;
            const xEffective = getEffectiveGrade({ base: x, bonus: varBonus }, maxScale, capBonusAtMax);
            const pointsBeforeTarget = fixedPoints + xEffective * varWeight;
            const requiredEffective = (goalGrade - pointsBeforeTarget) / targetWeight;
            const yRequiredBase = requiredEffective - targetBonus;
            points.push({
                x,
                xEffective,
                yRequiredBase,
            });
        }
        return points;
    }

    /**
     * Genera la curva de nota definitiva resultante variando la nota base del objetivo (0..maxScale).
     * @param {Array} items
     * @param {number} maxScale
     * @param {boolean} capBonusAtMax
     * @param {number} steps
     * @returns {Array<{x: number, finalGrade: number}>}
     */
    function buildFinalGradeCurve(items, maxScale, capBonusAtMax, steps) {
        const targetItem = items.find((it) => it.role === 'target');
        if (!targetItem) return [];

        const otherPoints = items.reduce((acc, it) => {
            if (it.id === targetItem.id) return acc;
            const w = (Number(it.weight) || 0) / 100;
            return acc + getEffectiveGrade(it, maxScale, capBonusAtMax) * w;
        }, 0);

        const targetWeight = (Number(targetItem.weight) || 0) / 100;
        const targetBonus = Number(targetItem.bonus) || 0;

        const points = [];
        const totalSteps = steps || 50;
        for (let i = 0; i <= totalSteps; i++) {
            const x = (maxScale * i) / totalSteps;
            const eff = getEffectiveGrade({ base: x, bonus: targetBonus }, maxScale, capBonusAtMax);
            points.push({
                x,
                finalGrade: otherPoints + eff * targetWeight,
            });
        }
        return points;
    }

    global.GradeCalc = {
        clamp,
        getEffectiveGrade,
        computeSummary,
        buildSensitivityCurve,
        buildFinalGradeCurve,
    };
})(window);
