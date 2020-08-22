# grub config

```

if [ -s $prefix/grubenv ]; then
  load_env
fi

# if enable_boot_counter
#  increase boot_count by 1
#  save_env boot_count
#  set boot_seen=true
#  save_env boot_seen
# if boot_count more than 3
#   take prev drv path and replace menu entry using if (creating it should be enough since it will be at the top now)
#     this should be pregenrated so we already have it instead of loading it
#     in menu item
#       set boot_trash=true
#       save_env boot_trash
```

# cmds

init

```
#!/bin/sh

set -euo pipefail

FILE="$1"

if [ ! -e "$FILE" ]; then
  grub-editenv $FILE create
fi
grub-editenv $FILE set enable_boot_counter=true
grub-editenv $FILE unset boot_count
grub-editenv $FILE unset boot_seen
```

post

```
#!/bin/sh

set -euo pipefail

FILE="$1"
OUT="$2"

check_var() {
  grub-editenv $FILE list | grep "^$1=" > /dev/null
}

if check_var boot_seen; then
  if check_var boot_trash; then
    echo "rollback" > "$OUT"
  else
    echo "success" > "$OUT"
  fi
  grub-editenv $FILE unset enable_boot_counter
  grub-editenv $FILE unset boot_count
  grub-editenv $FILE unset boot_trash
  grub-editenv $FILE unset boot_seen
fi
```
