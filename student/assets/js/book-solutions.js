
function stepDefaultLabel(type) {
    return '';
}

function renderStructuredSteps(steps) {
    if (!Array.isArray(steps) || !steps.length) return '';

    return `<div class="bs-structured-steps">
        ${steps.map(step => {
            const type = String(step?.type || 'equation').toLowerCase();

            const content = safe(step?.html ?? step?.content ?? '');

            const cls = [
                'given',
                'find',
                'formula',
                'equation',
                'calculation',
                'hcf',
                'lcm',
                'verification',
                'conclusion',
                'prose',
                'heading'
            ].includes(type) ? type : 'equation';

            if (!content.trim()) return '';

            return `
                <div class="bs-step bs-step-${cls}" data-step="${esc(type)}">
                    <div class="bs-step-content">${content}</div>
                </div>
            `;
        }).join('')}
    </div>`;
}
