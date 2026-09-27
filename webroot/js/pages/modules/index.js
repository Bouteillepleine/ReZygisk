import { exec, toast } from '../../kernelsu.js'

import { whichCurrentPage } from '../navbar.js'
import { getStrings } from '../pageLoader.js'

const VALID_MODULE_ID = /^[A-Za-z0-9._-]+$/

async function _getReZygiskState() {
  let stateCmd = await exec('/system/bin/cat /data/adb/rezygisk/state.json')
  if (stateCmd.errno !== 0) {
    toast('Error getting state of ReZygisk!')

    return null
  }

  try {
    return JSON.parse(stateCmd.stdout)
  } catch {
    return null
  }
}

async function _resolveModuleNames(modules) {
  const safe = modules.filter((mod) => VALID_MODULE_ID.test(mod.id))

  for (const mod of modules) {
    mod.name = mod.id
  }

  if (safe.length === 0) return

  /* INFO: Every entry prints exactly one line, so the replies stay aligned with
             the request order even when a module.prop is missing or nameless. */
  const command = safe.map((mod) => {
    const propPath = `/data/adb/modules/${mod.id}/module.prop`

    return `/system/bin/grep -m1 '^name=' '${propPath}' 2>/dev/null | /system/bin/cut -d '=' -f 2- | /system/bin/tr -d '\\r\\n' ; printf '\\n'`
  }).join(' ; ')

  const result = await exec(command)
  if (result.errno !== 0) return

  const names = result.stdout.split('\n')
  safe.forEach((mod, i) => {
    const name = (names[i] || '').trim()
    if (name.length !== 0) mod.name = name
  })
}

function _buildModuleCard(module, strings) {
  const card = document.createElement('div')
  card.className = 'module_card card surface'

  const name = document.createElement('div')
  name.className = 'module_name'
  name.textContent = module.name

  const meta = document.createElement('div')
  meta.className = 'module_meta'

  const label = document.createElement('span')
  label.className = 'module_meta_label'
  label.textContent = strings.arch

  const chips = document.createElement('div')
  chips.className = 'chip_row'

  for (const bits of module.bitsUsed) {
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.textContent = `${bits}-bit`
    chips.appendChild(chip)
  }

  meta.appendChild(label)
  meta.appendChild(chips)

  card.appendChild(name)
  card.appendChild(meta)

  return card
}

async function _updateDynamicElement() {
  const ReZygiskState = await _getReZygiskState()
  const strings = await getStrings(whichCurrentPage())
  const modules_list = document.getElementById('modules_list')
  const empty = document.getElementById('modules_list_not_avaliable')

  if (!modules_list) return

  const all_modules = []

  if (ReZygiskState && ReZygiskState.rezygiskd) {
    for (const daemon_bit of Object.keys(ReZygiskState.rezygiskd)) {
      const daemon = ReZygiskState.rezygiskd[daemon_bit]
      if (!daemon || !Array.isArray(daemon.modules)) continue

      for (const module_id of daemon.modules) {
        const module = all_modules.find((mod) => mod.id === module_id)

        if (module) module.bitsUsed.push(daemon_bit)
        else all_modules.push({ id: module_id, name: module_id, bitsUsed: [ daemon_bit ] })
      }
    }
  }

  if (all_modules.length === 0) {
    modules_list.replaceChildren(empty || document.createTextNode(''))
    if (empty) empty.style.display = 'flex'

    return
  }

  for (const module of all_modules) {
    module.bitsUsed.sort((a, b) => Number(b) - Number(a))
  }

  await _resolveModuleNames(all_modules)

  const fragment = document.createDocumentFragment()
  for (const module of all_modules) {
    fragment.appendChild(_buildModuleCard(module, strings))
  }

  modules_list.replaceChildren(fragment)
}

export async function loadOnce() {

}

export async function loadOnceView() {
  _updateDynamicElement()
}

export async function onceViewAfterUpdate() {
  _updateDynamicElement()
}

export async function load() {

}
