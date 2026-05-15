#!/bin/bash
# Logic: Run only if the day is 22-31 (Week 4)
DOM=$(date +%-d)

if (( DOM >= 22 && DOM <= 31 )); then
    /usr/bin/python3 /opt/Astraea-Agent/core/initialize.py
fi