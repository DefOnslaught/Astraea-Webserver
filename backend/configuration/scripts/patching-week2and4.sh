#!/bin/bash
# Logic: Run only if the day is 8-14 (Week 2) or 22-31 (Week 4+)
DOM=$(date +%d)

if (( DOM >= 8 && DOM <= 14 )) || (( DOM >= 22 && DOM <= 31 )); then
    /usr/bin/python3 /opt/Astraea-Agent/core/initialize.py
fi