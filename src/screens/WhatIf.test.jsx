import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WhatIfScreen } from './WhatIf';
import { buildDemoState, computeWeeksSummary, projectCashFlow } from '../lib/core';

const state = buildDemoState();
const weeksSummary = computeWeeksSummary(state);
const { weeklyBalances } = projectCashFlow(state, weeksSummary);

function renderScreen(onClose = () => {}) {
  return render(<WhatIfScreen state={state} weeklyBalances={weeklyBalances} onClose={onClose} />);
}

test('список сценариев показывает все 6 пунктов', () => {
  renderScreen();
  ['Ипотека', 'Автокредит', 'Потребкредит', 'Декрет', 'Крупная разовая трата', 'Свой сценарий'].forEach(title => {
    expect(screen.getByText(title)).toBeInTheDocument();
  });
});

test('стрелка "назад" со списка сценариев закрывает весь флоу', async () => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  renderScreen(onClose);
  await user.click(screen.getByLabelText('Назад'));
  expect(onClose).toHaveBeenCalled();
});

test('ипотека: «Посчитать» неактивна, пока не заполнены сумма/ставка/срок', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Ипотека'));
  expect(screen.getByText('Посчитать')).toBeDisabled();
  await user.type(screen.getAllByPlaceholderText('0')[0], '2650000');
  expect(screen.getByText('Посчитать')).toBeDisabled(); // сумма есть, но не ставки/срока
});

test('ипотека: заполнение полей считает аннуитет и включает «Посчитать»', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Ипотека'));
  const inputs = screen.getAllByPlaceholderText('0');
  await user.type(inputs[0], '2650000'); // сумма
  await user.type(inputs[1], '18,5'); // ставка
  await user.type(inputs[2], '20'); // срок
  expect(screen.getByText(/41[\s ]?\d{3} ₽/)).toBeInTheDocument(); // аннуитет посчитан
  expect(screen.getByText('Посчитать')).not.toBeDisabled();
});

test('ипотека → результат: подзаголовок с параметрами, кнопки «Изменить цифры» и «Понятно»', async () => {
  const user = userEvent.setup();
  const onClose = jest.fn();
  renderScreen(onClose);
  await user.click(screen.getByText('Ипотека'));
  const inputs = screen.getAllByPlaceholderText('0');
  await user.type(inputs[0], '2650000');
  await user.type(inputs[1], '18,5');
  await user.type(inputs[2], '20');
  await user.click(screen.getByText('Посчитать'));
  expect(screen.getByText(/2 650 000 ₽ · 18,5% · 20 лет/)).toBeInTheDocument();
  expect(screen.getByText('Ничего не сохранилось — ваш план остался как был.')).toBeInTheDocument();
  await user.click(screen.getByText('Понятно'));
  expect(onClose).toHaveBeenCalled();
});

test('ипотека: «Изменить цифры» возвращает на форму с сохранёнными значениями', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Ипотека'));
  const inputs = screen.getAllByPlaceholderText('0');
  await user.type(inputs[0], '2650000');
  await user.type(inputs[1], '18,5');
  await user.type(inputs[2], '20');
  await user.click(screen.getByText('Посчитать'));
  await user.click(screen.getByText('Изменить цифры'));
  expect(screen.getByDisplayValue('2 650 000')).toBeInTheDocument();
});

test('«Ввести вручную» переключает расчётный платёж в редактируемое поле', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Ипотека'));
  await user.click(screen.getByText('Ввести вручную'));
  expect(screen.getByText('Считать по формуле')).toBeInTheDocument();
  expect(screen.getByText('Посчитать')).toBeDisabled(); // ручной платёж ещё не введён
});

test('переключение сценария сбрасывает параметры (регрессия: сумма ипотеки не должна протекать в «Свой сценарий»)', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Ипотека'));
  await user.type(screen.getAllByPlaceholderText('0')[0], '2650000');
  await user.click(screen.getByLabelText('Назад')); // назад к списку
  await user.click(screen.getByText('Свой сценарий'));
  const amountField = screen.getByPlaceholderText('0');
  expect(amountField).toHaveValue('');
});

test('регрессия: «начать с [месяц]» не предлагается, если это просто конец видимого окна, а не реальное спасение', async () => {
  // Баг с реального скриншота: платёж такой большой, что минус только растёт
  // неделя к неделе (нед.10 глубже нед.1) — но подсказка всё равно предлагала
  // «начать с Октябрь 2026», потому что к этому моменту окно почти кончалось и
  // проверять было почти нечего. Огромный кредит здесь специально воспроизводит
  // этот же монотонно нарастающий минус.
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Ипотека'));
  const inputs = screen.getAllByPlaceholderText('0');
  await user.type(inputs[0], '20000000');
  await user.type(inputs[1], '10');
  await user.type(inputs[2], '15');
  await user.click(screen.getByText('Посчитать'));
  expect(screen.getByText(/уйдёте в минус/)).toBeInTheDocument();
  expect(screen.queryByText(/если начать с/)).not.toBeInTheDocument();
});

test('дата старта сценария выбрана далеко в будущем: график в порядке, но предупреждает про минус позже', async () => {
  // Если сценарий стартует за пределами видимых 10 недель, график не покажет
  // разницы вовсе («Сейчас»/«Со сценарием» совпадут) — раньше это означало
  // молчаливое «✓ Потянете», даже если после реального старта деньги кончатся.
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Свой сценарий'));
  await user.type(screen.getByPlaceholderText('Например, ремонт кухни'), 'Большая подписка');
  await user.type(screen.getByPlaceholderText('0'), '300000'); // крупная регулярная трата — точно не потянуть бессрочно
  const [startSelect] = screen.getAllByRole('combobox');
  const farOption = startSelect.querySelectorAll('option')[6]; // ~полгода вперёд — заведомо за пределами 10-недельного графика
  await user.selectOptions(startSelect, farOption);
  await user.click(screen.getByText('Посчитать'));
  expect(screen.queryByText(/уйдёте в минус/)).not.toBeInTheDocument();
  expect(screen.getByText(/хватает, но дальше/)).toBeInTheDocument();
});

test('декрет: падение дохода при неудачном сценарии показывает риск и подсказку', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Декрет'));
  await user.type(screen.getByPlaceholderText('0'), '30000');
  await user.click(screen.getByText('Посчитать'));
  expect(screen.getByText(/уйдёте в минус/)).toBeInTheDocument();
  expect(screen.getByText(/Разрыв уходит, если платёж не выше/)).toBeInTheDocument();
});

test('свой сценарий: разово/в месяц — переключатель и подстановка в подзаголовок результата', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Свой сценарий'));
  await user.type(screen.getByPlaceholderText('Например, ремонт кухни'), 'Ремонт кухни');
  await user.type(screen.getByPlaceholderText('0'), '150000');
  await user.click(screen.getByText('Разово'));
  await user.click(screen.getByText('Посчитать'));
  expect(screen.getByText(/Ремонт кухни · 150 000 ₽ разово/)).toBeInTheDocument();
});

test('свой сценарий: «До какого месяца» видно только в режиме «В месяц» (по умолчанию — Бессрочно)', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Свой сценарий'));
  expect(screen.getByText('До какого месяца')).toBeInTheDocument();
  expect(screen.getByText('Бессрочно')).toBeInTheDocument();
  await user.click(screen.getByText('Разово'));
  expect(screen.queryByText('До какого месяца')).not.toBeInTheDocument();
});

test('свой сценарий: заданный «До какого месяца» попадает в подзаголовок результата', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByText('Свой сценарий'));
  await user.type(screen.getByPlaceholderText('Например, ремонт кухни'), 'Няня на полгода');
  await user.type(screen.getByPlaceholderText('0'), '20000');
  const selects = screen.getAllByRole('combobox');
  const endSelect = selects[selects.length - 1]; // «До какого месяца» — последний select в форме
  await user.selectOptions(endSelect, endSelect.querySelectorAll('option')[2]); // третий месяц после старта
  await user.click(screen.getByText('Посчитать'));
  expect(screen.getByText(/Няня на полгода · 20 000 ₽ в мес\. ·.* – /)).toBeInTheDocument();
});
