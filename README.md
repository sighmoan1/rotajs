# Rotajs

Written in python by an AI then converted to javascript so it can run in browser. No data needs to leave the user's device so it's safe to use with people's names etc.

## Approach

Approximately:

1. Allocate all the TL shifts to TLs, because only TLs can do them
2. Allocate all the DM shifts to DMs who are not TLs, because they will be behind on shifts since step 1
3. If a DM who is not a TL has more shifts than a TL, start including TLs in the list of people we are giving DM shifts to (doesn't happen at these staffing levels)

## Result

* All the TLs get either 29 or 30 shifts TL shifts and 0 DM shifts.

* DMs get 20 or 21 shifts.

* We can't make it fairer than that because DMs can't do TL shifts

## Shortcomings

* Shifts are far apart for individuals
  * People perhaps don't want that. We could come up with some system for deciding the order people choose in up to the limits we have identified

* Model doesn't account for part-timers.
  * We could extend the model
  * We could multiple part-timers shift allocation by their FTE then distribute their shifts manually starting from the person with the fewer filled shifts (basically what the model does anyway)
  
* Model doesn't account for day of week or month of year preferences
  * We could attempt to include these in the model
  * We could leave this to individuals to trade between themselves (probably prefered and will happen anyway even if we enhance the model so that it provides a second pass)
