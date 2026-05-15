#!/bin/bash
# Logic: Run only if the day is 8-14 (Week 2)
DOM=$(date +%-d)

if (( DOM >= 8 && DOM <= 14 )); then
    /usr/bin/python3 /opt/Astraea-Agent/core/initialize.py
fi