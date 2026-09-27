import { whichCurrentPage } from '../navbar.js'
import { getStrings } from '../pageLoader.js'
import { exec, toast } from '../../kernelsu.js'

async function _getMonitorState() {
  const stateCmd = await exec('/system/bin/cat /data/adb/rezygisk/state.json')
  if (stateCmd.errno !== 0) {
    toast('Error getting state of ReZygisk!')

    return;
  }

  try {
    const ReZygiskState = JSON.parse(stateCmd.stdout)

    return ReZygiskState.monitor.state
  } catch {
    return null;
  }
}

let tracerBinary = null

async function _getTracerBinary() {
  if (tracerBinary) return tracerBinary

  const probe = await exec('for b in 64 32; do if [ -x "/data/adb/modules/rezygisk/bin/zygisk-ptrace$b" ]; then echo "$b"; break; fi; done')
  const bits = probe.errno === 0 && probe.stdout.trim() === '32' ? '32' : '64'

  tracerBinary = `/data/adb/modules/rezygisk/bin/zygisk-ptrace${bits}`

  return tracerBinary
}

async function _sendControl(command) {
  const binary = await _getTracerBinary()

  const result = await exec(`${binary} ctl ${command}`)
  if (result.errno !== 0) toast('Failed to reach the ReZygisk monitor!')

  return result.errno === 0
}

async function _updateDynamicElement() {
  const monitor_status = document.getElementById('monitor_status')
  const strings = await getStrings(whichCurrentPage())
  const monitorState = await _getMonitorState()

  if (monitorState == null) return;

  switch (Number(monitorState)) {
    case 0: monitor_status.textContent = strings.monitor.status.tracing; break;
    case 1: monitor_status.textContent = strings.monitor.status.stopping; break;
    case 2: monitor_status.textContent = strings.monitor.status.stopped; break;
    case 3: monitor_status.textContent = strings.monitor.status.exiting; break;
    default: monitor_status.textContent = strings.monitor.status.unknown;
  }
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
  const monitor_start = document.getElementById('monitor_start_button')
  const monitor_stop = document.getElementById('monitor_stop_button')
  const monitor_pause = document.getElementById('monitor_pause_button')
  const monitor_status = document.getElementById('monitor_status')
  const strings = await getStrings(whichCurrentPage())

  const controllable = [
    strings.monitor.status.tracing,
    strings.monitor.status.stopping,
    strings.monitor.status.stopped
  ]

  monitor_start.addEventListener('click', async () => {
    if (!controllable.includes(monitor_status.textContent)) return;

    monitor_status.textContent = strings.monitor.status.tracing
    await _sendControl('start')
  })

  monitor_stop.addEventListener('click', async () => {
    monitor_status.textContent = strings.monitor.status.exiting
    await _sendControl('exit')
  })

  monitor_pause.addEventListener('click', async () => {
    if (!controllable.includes(monitor_status.textContent)) return;

    monitor_status.textContent = strings.monitor.status.stopped
    await _sendControl('stop')
  })

  return;
}