const views = [...document.querySelectorAll('.view')];
const navItems = [...document.querySelectorAll('.nav-item[data-view]')];
const sidebar = document.querySelector('.sidebar');

function showView(id) {
  views.forEach((view) => view.classList.toggle('active-view', view.id === id));
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === id || (id === 'brief-detail' && item.dataset.view === 'briefs')));
  sidebar.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  history.replaceState(null, '', `#${id}`);
}

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-view]');
  const target = event.target.closest('[data-view-target]');
  if (nav) showView(nav.dataset.view);
  if (target) showView(target.dataset.viewTarget);
  if (event.target.closest('[data-open-brief]')) showView('brief-detail');
});

document.querySelector('.mobile-menu').addEventListener('click', () => sidebar.classList.toggle('open'));

const sourceModal = document.querySelector('#source-modal');
const decisionModal = document.querySelector('#decision-modal');
const modals = [sourceModal, decisionModal];
function openModal(modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
function closeModal(modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

document.querySelectorAll('[data-action="open-sources"]').forEach((button) => button.addEventListener('click', () => openModal(sourceModal)));
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop'))));
modals.forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); }));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') modals.forEach(closeModal); });

document.querySelector('#file-input').addEventListener('change', (event) => {
  if (!event.target.files.length) return;
  closeModal(sourceModal);
  showToast(`${event.target.files.length} source${event.target.files.length > 1 ? 's' : ''} added`, 'ProofLoop is mapping claims and checking source boundaries.');
});

const decisionCopy = {
  approve: ['Approve with guardrail?', 'This records your authorization and tells the delivery team to add a hard 30-second timeout before release.', 'Confirm approval'],
  revise: ['Request a revision?', 'Add conditions below. ProofLoop will preserve them as confirmed decision context for the next evaluation.', 'Send revision'],
  reject: ['Reject this change?', 'The delivery team will be told to retain v2.3. Your rationale will be preserved for future recommendations.', 'Confirm rejection']
};
let activeDecision = 'approve';
document.querySelectorAll('[data-decision]').forEach((button) => button.addEventListener('click', () => {
  activeDecision = button.dataset.decision;
  const copy = decisionCopy[activeDecision];
  document.querySelector('#decision-title').textContent = copy[0];
  document.querySelector('#decision-description').textContent = copy[1];
  document.querySelector('#confirm-decision').textContent = copy[2];
  openModal(decisionModal);
}));

document.querySelector('#confirm-decision').addEventListener('click', () => {
  closeModal(decisionModal);
  const outcome = activeDecision === 'approve' ? 'Approved with guardrail' : activeDecision === 'revise' ? 'Revision requested' : 'Change rejected';
  showToast(outcome, 'Delivery team notified. Decision memory updated.');
  document.querySelector('#decision-note').value = '';
  setTimeout(() => showView('activity'), 1200);
});

document.querySelector('#toggle-evidence').addEventListener('click', () => {
  document.querySelector('#expanded-evidence').classList.toggle('open');
  document.querySelector('.toggle-chevron').classList.toggle('rotated');
});

document.querySelector('#confidence-info').addEventListener('click', () => {
  showToast('92% evidence confidence', 'Based on source coverage, recency, agreement, and evaluation repeatability.');
});

function showToast(title, message) {
  const toast = document.querySelector('#toast');
  toast.querySelector('strong').textContent = title;
  toast.querySelector('p').textContent = message;
  toast.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove('show'), 4300);
}
document.querySelector('#toast button').addEventListener('click', () => document.querySelector('#toast').classList.remove('show'));

let elapsed = 18 * 60 + 32;
setInterval(() => {
  elapsed += 1;
  const min = Math.floor(elapsed / 60);
  const sec = String(elapsed % 60).padStart(2, '0');
  document.querySelector('#open-timer').textContent = `${min}m ${sec}s`;
}, 1000);

const initialView = location.hash.replace('#', '');
showView(views.some((v) => v.id === initialView) ? initialView : 'overview');
