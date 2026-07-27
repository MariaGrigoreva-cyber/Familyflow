import '@testing-library/jest-dom';

// jsdom не реализует scrollTo/scrollIntoView — карусель советов на «Сегодня»
// и автоскролл к шагу обучающего тура вызывают их безусловно в эффектах.
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
