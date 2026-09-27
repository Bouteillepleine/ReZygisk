import { exec, toast } from '../../kernelsu.js'

import { whichCurrentPage } from '../navbar.js'
import { getStrings } from '../pageLoader.js'

let rzState = {
  actuallyWorking: 0,
  expectedWorking: 0
}

async function _getReZygiskState() {
  let stateCmd = await exec('/system/bin/cat /data/adb/rezygisk/state.json')
  if (stateCmd.errno !== 0) {
    toast('Error getting state of ReZygisk!')

    return;
  }

  try {
    const ReZygiskState = JSON.parse(stateCmd.stdout)
    return ReZygiskState
  } catch {
    return null;
  }
}

async function _getVersion() {
  let moduleProp = await exec('cat /data/adb/modules/rezygisk/module.prop')
  if (moduleProp.errno !== 0) {
    toast('Error getting state of ReZygisk!')

    return;
  }

  let version = '???'
  moduleProp.stdout.split('\n').forEach((line) => {
    if (line.startsWith('version=')) version = line.slice('version='.length).trim()
  })

  return version
}

async function _getKernelString() {
  const unameCmd = await exec('/system/bin/uname -r')
  if (unameCmd.errno !== 0) {
    toast('Error getting kernel version!')
    return '???'
  }

  if (unameCmd.stdout && unameCmd.stdout.trim().length !== 0) {
    return unameCmd.stdout.trim()
  } else {
    return '???'
  }
}

async function _getAndroidVersion() {
  const androidVersionCmd = await exec('/system/bin/getprop ro.build.version.release')
  if (androidVersionCmd.errno !== 0) {
    toast('Error getting android version!')
    return '???'
  }

  if (androidVersionCmd.stdout && androidVersionCmd.stdout.trim().length !== 0) {
    return androidVersionCmd.stdout.trim()
  } else {
    return '???'
  }
}

function _setStateIcon(container, icon) {
  const img = document.createElement('img')
  img.src = `assets/${icon}.svg`
  img.alt = ''

  container.replaceChildren(img)
}

async function _updateDynamicElement(firstRun, ReZygiskState, strings) {
  const rootCss = document.querySelector(':root')
  const rz_state = document.getElementById('rz_state')
  const rz_icon_state = document.getElementById('rz_icon_state')

  const zygote_divs = [
    document.getElementById('zygote64'),
    document.getElementById('zygote32')
  ]

  const zygote_status_divs = [
    document.getElementById('zygote64_status'),
    document.getElementById('zygote32_status')
  ]

  /* INFO: Just ensure that they won't appear unless there's info */
  zygote_divs.forEach((zygote_div) => {
    zygote_div.style.display = 'none'
  })

  if (ReZygiskState == null) {
    rz_state.textContent = strings.unknown
    _setStateIcon(rz_icon_state, 'mark')
    document.getElementById('zygote_class').style.display = 'none'
    /* INFO: This hides the throbber screen */
    loading_screen.style.display = 'none'
    return;
  }

  const zygote = ReZygiskState.zygote || {}

  rzState.expectedWorking = 0
  rzState.actuallyWorking = 0

  const bits = [ '64', '32' ]
  bits.forEach((abi, index) => {
    if (zygote[abi] === undefined) return

    rzState.expectedWorking++

    zygote_divs[index].style.display = 'block'

    switch (Number(zygote[abi])) {
      case 1: {
        zygote_status_divs[index].textContent = strings.info.zygote.injected
        rzState.actuallyWorking++

        break
      }
      case 0: zygote_status_divs[index].textContent = strings.info.zygote.notInjected; break
      default: zygote_status_divs[index].textContent = strings.info.zygote.unknown
    }
  })

  if (rzState.expectedWorking === 0 || rzState.actuallyWorking === 0) {
    rz_state.textContent = strings.status.notWorking
    _setStateIcon(rz_icon_state, 'mark')
    rootCss.style.setProperty('--state', 'var(--state-error)')
  } else if (rzState.expectedWorking === rzState.actuallyWorking) {
    rz_state.textContent = strings.status.ok
    _setStateIcon(rz_icon_state, 'tick')
    rootCss.style.setProperty('--state', 'var(--state-ok)')
  } else {
    rz_state.textContent = strings.status.partially
    _setStateIcon(rz_icon_state, 'warn')
    rootCss.style.setProperty('--state', 'var(--state-warn)')
  }

  if (rzState.expectedWorking === 0) {
    document.getElementById('zygote_class').style.display = 'none'
  }
}

export async function loadOnce() {

}

export async function loadOnceView() {
  document.getElementById('version_code').textContent = await _getVersion()

  document.getElementById('kernel_version_div').textContent = await _getKernelString()
  document.getElementById('android_version_div').textContent = await _getAndroidVersion()

  const ReZygiskState = await _getReZygiskState()
  const strings = await getStrings(whichCurrentPage())

  let root_impl = ReZygiskState ? ReZygiskState.root : null
  if (!root_impl) root_impl = strings.unknown
  if (root_impl === 'Multiple') root_impl = strings.rootImpls.multiple

  document.getElementById('root_impl').textContent = root_impl

  _updateDynamicElement(true, ReZygiskState, strings)

  /* INFO: This hides the throbber screen */
  loading_screen.style.display = 'none'
}

export async function onceViewAfterUpdate() {
  const ReZygiskState = await _getReZygiskState()
  const strings = await getStrings(whichCurrentPage())
  _updateDynamicElement(false, ReZygiskState, strings)
}

export async function load() {

}
