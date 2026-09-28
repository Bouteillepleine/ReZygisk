import { setDarkNav } from './darkNavbar.js'

const rootCss = document.querySelector(':root')

export function setDark(chooseSet) {
  rootCss.style.setProperty('--background', '#141414')
  rootCss.style.setProperty('--font', '#ffffff')
  rootCss.style.setProperty('--desc', '#c9c9c9')
  rootCss.style.setProperty('--dim', '#1c1c1c')
  rootCss.style.setProperty('--icon', '#494949')
  rootCss.style.setProperty('--icon-bc', '#292929')
  rootCss.style.setProperty('--desktop-navbar', '#252525')
  rootCss.style.setProperty('--button-enabled', '#535353')
  rootCss.style.setProperty('--icon-filter', 'invert(1)')
  rootCss.style.setProperty('--desktop-navicon', '#3a3a3a')
  rootCss.style.setProperty('--button', 'var(--background)')
  rootCss.style.setProperty('--outline', 'rgba(255, 255, 255, 0.15)')
  rootCss.style.setProperty('--outline-strong', 'rgba(255, 255, 255, 0.28)')
  rootCss.style.setProperty('--danger', '#e79ba3')

  if (chooseSet) setData('dark')
  setDarkNav()
}

function setData(mode) {
  localStorage.setItem('/ReZygisk/theme', mode)

  return mode
}