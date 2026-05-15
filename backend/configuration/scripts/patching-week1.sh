#!/bin/bash
# Logic: Run only if the day is 1-7 (Week 1)
DOM=$(date +%-d)

if (( DOM >= 1 && DOM <= 7 )); then
    /usr/bin/python3 /opt/Astraea-Agent/core/initialize.py
fi