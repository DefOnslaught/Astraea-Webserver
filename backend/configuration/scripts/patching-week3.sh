#!/bin/bash
# Logic: Run only if the day is 15-21 (Week 3)
DOM=$(date +%-d)

if (( DOM >= 14 && DOM <= 21 )); then
    /usr/bin/python3 /opt/Astraea-Agent/core/initialize.py
fi