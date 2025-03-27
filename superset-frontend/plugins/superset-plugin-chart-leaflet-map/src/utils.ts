export const createToolTip = (
  longitude: number,
  latitude: number,
  category: string,
) => {
  const toolTip = document.createElement('div');
  toolTip.innerHTML = `
  <strong>العرض:</strong> ${latitude.toFixed(5)}<br>
  <strong>الطول:</strong> ${longitude.toFixed(5)}<br>
  <strong>المحافظة:</strong> ${category}
    `;
  return toolTip;
};
