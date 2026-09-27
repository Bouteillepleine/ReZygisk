# shellcheck disable=SC2034
SKIPUNZIP=1

DEBUG=@DEBUG@
MIN_KSU_VERSION=@MIN_KSU_VERSION@
MIN_KSUD_VERSION=@MIN_KSUD_VERSION@
MIN_MAGISK_VERSION=@MIN_MAGISK_VERSION@
MIN_APATCH_VERSION=@MIN_APATCH_VERSION@

if [ "$BOOTMODE" ] && [ "$KSU" ]; then
  ui_print "- Installing from KernelSU app"
  ui_print "- KernelSU version: $KSU_KERNEL_VER_CODE (kernel) + $KSU_VER_CODE (ksud)"
  if ! [ "$KSU_KERNEL_VER_CODE" ] || [ "$KSU_KERNEL_VER_CODE" -lt "$MIN_KSU_VERSION" ]; then
    ui_print "*********************************************************"
    ui_print "! KernelSU version is too old!"
    ui_print "! Please update KernelSU to latest version"
    abort    "*********************************************************"
  fi
  if ! [ "$KSU_VER_CODE" ] || [ "$KSU_VER_CODE" -lt "$MIN_KSUD_VERSION" ]; then
    ui_print "*********************************************************"
    ui_print "! ksud version is too old!"
    ui_print "! Please update KernelSU Manager to latest version"
    abort    "*********************************************************"
  fi
  if [ "$(which magisk)" ]; then
    ui_print "*********************************************************"
    ui_print "! Multiple root implementation is NOT supported!"
    ui_print "! Please uninstall Magisk before installing ReZygisk"
    abort    "*********************************************************"
  fi
  elif [ "$BOOTMODE" ] && [ "$APATCH" ]; then
    ui_print "- Installing from APatch app"
    if ! [ "$APATCH_VER_CODE" ] || [ "$APATCH_VER_CODE" -lt "$MIN_APATCH_VERSION" ]; then
      ui_print "*********************************************************"
      ui_print "! APatch version is too old!"
      ui_print "! Please update APatch to latest version"
      abort    "*********************************************************"
    fi
elif [ "$BOOTMODE" ] && [ "$MAGISK_VER_CODE" ]; then
  ui_print "- Installing from Magisk app"
  if [ "$MAGISK_VER_CODE" -lt "$MIN_MAGISK_VERSION" ]; then
    ui_print "*********************************************************"
    ui_print "! Magisk version is too old!"
    ui_print "! Please update Magisk to latest version"
    abort    "*********************************************************"
  fi
else
  ui_print "*********************************************************"
  ui_print "! Install from recovery is not supported"
  ui_print "! Please install from KernelSU or Magisk app"
  abort    "*********************************************************"
fi

VERSION=$(grep_prop version "${TMPDIR}/module.prop")
ui_print "- Installing ReZygisk $VERSION"

# check android
if [ "$API" -lt 25 ]; then
  ui_print "! Unsupported sdk: $API"
  abort "! Minimal supported sdk is 25 (Android 7.1)"
else
  ui_print "- Device sdk: $API"
fi

# check architecture
if [ "$ARCH" != "arm" ] && [ "$ARCH" != "arm64" ] && [ "$ARCH" != "x86" ] && [ "$ARCH" != "x64" ]; then
  abort "! Unsupported platform: $ARCH"
else
  ui_print "- Device platform: $ARCH"
fi

ui_print "- Extracting verify.sh"
unzip -o "$ZIPFILE" 'verify.sh' -d "$TMPDIR" >&2
if [ ! -f "$TMPDIR/verify.sh" ]; then
  ui_print "*********************************************************"
  ui_print "! Unable to extract verify.sh!"
  ui_print "! This zip may be corrupted, please try downloading again"
  abort    "*********************************************************"
fi
. "$TMPDIR/verify.sh"
extract "$ZIPFILE" 'customize.sh'  "$TMPDIR/.vunzip"
extract "$ZIPFILE" 'verify.sh'     "$TMPDIR/.vunzip"
extract "$ZIPFILE" 'sepolicy.rule' "$TMPDIR"

if [ "$KSU" ]; then
  ui_print "- Checking SELinux patches"
  if ! check_sepolicy "$TMPDIR/sepolicy.rule"; then
    ui_print "*********************************************************"
    ui_print "! Unable to apply SELinux patches!"
    ui_print "! Your kernel may not support SELinux patch fully"
    abort    "*********************************************************"
  fi
fi

ui_print "- Extracting module files"
extract "$ZIPFILE" 'module.prop'     "$MODPATH"
extract "$ZIPFILE" 'post-fs-data.sh' "$MODPATH"
extract "$ZIPFILE" 'service.sh'      "$MODPATH"
extract "$ZIPFILE" 'uninstall.sh'    "$MODPATH"
extract "$ZIPFILE" 'rezygisk.sh' "/data/adb/service.d/"

cp "$MODPATH/module.prop" "$MODPATH/module.prop.bak"

chmod +x "$MODPATH/uninstall.sh"
chmod +x "/data/adb/service.d/rezygisk.sh"

mv "$TMPDIR/sepolicy.rule" "$MODPATH"

mkdir "$MODPATH/bin"
mkdir "$MODPATH/webroot"

ui_print "- Extracting webroot"
unzip -o "$ZIPFILE" "webroot/*" -d "$MODPATH" >&2

ui_print "- Verifying webroot"
WEBROOT_SUMS="$TMPDIR/webroot.sha256sums"
: > "$WEBROOT_SUMS"
find "$MODPATH/webroot" -type f -name '*.sha256' -exec sh -c 'printf "%s  %s\n" "$(cat "$1")" "${1%.sha256}"' _ {} \; >> "$WEBROOT_SUMS"

if [ ! -s "$WEBROOT_SUMS" ]; then
  ui_print "*********************************************************"
  ui_print "! The webroot carries no checksums"
  abort    "*********************************************************"
fi

if ! sha256sum -c -s "$WEBROOT_SUMS"; then
  ui_print "*********************************************************"
  ui_print "! Failed to verify the webroot"
  ui_print "! This zip may be corrupted, please try downloading again"
  abort    "*********************************************************"
fi

find "$MODPATH/webroot" -type f -name '*.sha256' -delete

# INFO: Utilize the one with the biggest output, as some devices with Tango have the full list
#         in ro.product.cpu.abilist but others only have a subset there, and the full list in
#         ro.system.product.cpu.abilist
CPU_ABIS_PROP1=$(getprop ro.system.product.cpu.abilist)
CPU_ABIS_PROP2=$(getprop ro.product.cpu.abilist)

if [ "${#CPU_ABIS_PROP2}" -gt "${#CPU_ABIS_PROP1}" ]; then
  CPU_ABIS=$CPU_ABIS_PROP2
else
  CPU_ABIS=$CPU_ABIS_PROP1
fi

SUPPORTS_32BIT=false
SUPPORTS_64BIT=false

if [[ "$CPU_ABIS" == *"x86"* && "$CPU_ABIS" != "x86_64" || "$CPU_ABIS" == *"armeabi"* ]]; then
  SUPPORTS_32BIT=true
  ui_print "- Device supports 32-bit"
fi

if [[ "$CPU_ABIS" == *"x86_64"* || "$CPU_ABIS" == *"arm64-v8a"* ]]; then
  SUPPORTS_64BIT=true
  ui_print "- Device supports 64-bit"
fi

if [ "$ARCH" = "x86" ] || [ "$ARCH" = "x64" ]; then
  ABI_32=x86
  ABI_64=x86_64
  MACHIKADO_32=machikado.x86
  MACHIKADO_64=machikado.x86_64
else
  ABI_32=armeabi-v7a
  ABI_64=arm64-v8a
  MACHIKADO_32=machikado.arm
  MACHIKADO_64=machikado.arm64
fi

zip_has() {
  unzip -l "$ZIPFILE" "$1" > /dev/null 2>&1
}

require_abi() {
  if zip_has "bin/$1/zygiskd"; then
    return 0
  fi

  ui_print "*********************************************************"
  ui_print "! This device needs the $1 payload, which this build does not carry"
  ui_print "! Rebuild with ARCHS including $1, or install a build that has it"
  abort    "*********************************************************"
}

if [ "$SUPPORTS_32BIT" = true ]; then
  require_abi "$ABI_32"

  mkdir "$MODPATH/lib"

  ui_print "- Extracting $ABI_32 libraries"
  extract "$ZIPFILE" "bin/$ABI_32/zygiskd" "$MODPATH/bin" true
  mv "$MODPATH/bin/zygiskd" "$MODPATH/bin/zygiskd32"
  extract "$ZIPFILE" "lib/$ABI_32/libzygisk.so" "$MODPATH/lib" true
  extract "$ZIPFILE" "lib/$ABI_32/libzygisk_ptrace.so" "$MODPATH/bin" true
  mv "$MODPATH/bin/libzygisk_ptrace.so" "$MODPATH/bin/zygisk-ptrace32"

  extract "$ZIPFILE" "$MACHIKADO_32" "$MODPATH" true
fi

if [ "$SUPPORTS_64BIT" = true ]; then
  require_abi "$ABI_64"

  mkdir "$MODPATH/lib64"

  ui_print "- Extracting $ABI_64 libraries"
  extract "$ZIPFILE" "bin/$ABI_64/zygiskd" "$MODPATH/bin" true
  mv "$MODPATH/bin/zygiskd" "$MODPATH/bin/zygiskd64"
  extract "$ZIPFILE" "lib/$ABI_64/libzygisk.so" "$MODPATH/lib64" true
  extract "$ZIPFILE" "lib/$ABI_64/libzygisk_ptrace.so" "$MODPATH/bin" true
  mv "$MODPATH/bin/libzygisk_ptrace.so" "$MODPATH/bin/zygisk-ptrace64"

  extract "$ZIPFILE" "$MACHIKADO_64" "$MODPATH" true
fi

ui_print "- Setting permissions"
set_perm_recursive "$MODPATH/bin" 0 0 0755 0755

if [ "$SUPPORTS_32BIT" = true ]; then
  set_perm_recursive "$MODPATH/lib" 0 0 0755 0644 u:object_r:system_lib_file:s0
fi

if [ "$SUPPORTS_64BIT" = true ]; then
  set_perm_recursive "$MODPATH/lib64" 0 0 0755 0644 u:object_r:system_lib_file:s0
fi

# If Huawei's Maple is enabled, system_server is created with a special way which is out of Zygisk's control
HUAWEI_MAPLE_ENABLED=$(grep_prop ro.maple.enable)
if [ "$HUAWEI_MAPLE_ENABLED" == "1" ]; then
  ui_print "- Add ro.maple.enable=0"
  echo "ro.maple.enable=0" >>"$MODPATH/system.prop"
fi
