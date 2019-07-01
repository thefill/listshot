require('angular');

module.exports = [
    '$scope',
    '$element',
    FastScroll
];

function FastScroll(
    $scope,
    $element
){
    const ctrl = this;

    // scroll base elements
    ctrl.scrollbar = null;
    // reference to the element that fills scroll container
    ctrl.containerFiller = null;
    // whats the total height of the scrollbar
    ctrl.totalHeight = 0;
    // height of the visible container area
    ctrl.viewHeight = 0;
    // how much scroll has been moved
    ctrl.scrollbarScrollFromTop = 0;
    // group count
    ctrl.groupElementCount = 0;
    // group node height
    ctrl.groupElementHeight = 0;
    ctrl.groupExpandedPosition = -1;
    // element count
    ctrl.elementCount = 0;
    // element node height
    ctrl.elementHeight = 0;
    // reference to the external element container (used to
    // intercept scroll event and calculate visible height)
    ctrl.containerElement = null;
    // how many groups we can show
    ctrl.visibleGroupLimit = 0;
    // whats the current group position
    ctrl.visibleGroupPosition = 0;
    // how many elements we can show
    ctrl.visibleElementLimit = 0;
    // whats the current position
    ctrl.visibleElementPosition = 0;

    // Height of clusters of group elements created when one group expands
    ctrl.upperGroupStackHeight = 0;
    ctrl.lowerGroupStackHeight = 0;
    // group stack counts
    ctrl.upperGroupStackCount = 0;
    ctrl.lowerGroupStackCount = 0;

    ctrl.onContainerScroll = onContainerScroll.bind(ctrl);
    ctrl.onScrollbarScroll = onScrollbarScroll.bind(ctrl);
    ctrl.onInit = onInit.bind(ctrl);
    ctrl.redraw = redraw.bind(ctrl);
    ctrl.inputChange = inputChange.bind(ctrl);
    ctrl.onDestroy = onDestroy.bind(ctrl);

    ctrl.$onChanges = ctrl.inputChange;
    ctrl.$onDestroy = ctrl.onDestroy;
    ctrl.$onInit = ctrl.onInit;

    function onInit(){
        const elements = $element.find('div');
        ctrl.scrollbar = elements[0];
        ctrl.containerFiller = elements[1];

        setupScrollbarEvent();

        // if component ready for calculation
        if(isComponentReady()){
            resolveElementHeights();
            resolveLimitAndPosition();
            ctrl.redraw();
        }
    }

    /**
     * Check if we scrolled to upper group stack
     * @param scrolledDistance
     * @param upperGroupHeight
     * @return {boolean}
     */
    function isInUpperGroupStackArea(scrolledDistance, upperGroupHeight){
        return scrolledDistance <= upperGroupHeight;
    }

    /**
     * Check if we scrolled to lower group stack
     * @param scrolledDistance
     * @param lowerGroupHeight
     * @param viewHeight
     * @param totalHeight
     * @return {boolean}
     */
    function isInLowerGroupStackArea(scrolledDistance, lowerGroupHeight, viewHeight, totalHeight){
        // if lower stack dont exist
        if(!lowerGroupHeight){
            return false;
        }

        // if expanded group fits in view
        if(totalHeight <= viewHeight){
            return true;
        }

        // if we have longer list and we scrolled pass the upper edge of lower stack
        return scrolledDistance + viewHeight >= totalHeight - lowerGroupHeight;
    }

    function resolveLimitAndPosition(){
        const snapshot = resolveSnapshot();

        console.on();
        console.log('');
        console.log('-------------------------------------------------------------------');

        ctrl.visibleGroupPosition = snapshot.groupPosition;
        ctrl.visibleGroupLimit = snapshot.groupLimit;
        ctrl.visibleElementLimit = snapshot.elementLimit;
        ctrl.visibleElementPosition = snapshot.elementPosition;

        console.log('');
        console.log('Element position', ctrl.visibleElementPosition, ' / ', ctrl.elementCount);
        console.log('Element count', ctrl.visibleElementLimit);
        console.log('-');
        console.log('Group position', ctrl.visibleGroupPosition, ' / ', ctrl.groupElementCount);
        console.log('Group count', ctrl.visibleGroupLimit);
        console.off();

        onScrollChange();
    }

    function resolveSnapshot(){
        const scrolledDistance = ctrl.scrollbarScrollFromTop;
        const groupHeight = ctrl.groupElementHeight;
        const elementHeight = ctrl.elementHeight;
        const elementCount = ctrl.elementCount;
        const totalHeight = ctrl.totalHeight;
        const viewHeight = ctrl.viewHeight;
        const upperGroupHeight = ctrl.upperGroupStackHeight;
        const lowerGroupHeight = ctrl.lowerGroupStackHeight;
        const expandedPosition = ctrl.groupExpandedPosition;
        const groupCount = ctrl.groupElementCount;
        const lowerGroupCount = ctrl.lowerGroupStackCount;
        const upperGroupCount = ctrl.upperGroupStackCount;

        // If we scrolled into upper stack of collapsed group elements
        const inUpperGroupStackArea = isInUpperGroupStackArea(scrolledDistance, upperGroupHeight);
        // If we scrolled into lower stack of collapsed group elements
        const inLowerGroupStackArea = isInLowerGroupStackArea(
            scrolledDistance, lowerGroupHeight, viewHeight, totalHeight);

        // does all elements & groups fit in view
        const allFitsInView = totalHeight <= viewHeight;

        // did we scrolled to the top
        const scrolledToTop = !scrolledDistance;
        // did we scrolled to the top
        const scrolledToBottom = scrolledDistance + viewHeight === totalHeight;

        // calculate max elements on the view
        const maxElementsVisibleCount = Math.floor(viewHeight / elementHeight);
        const maxGroupsVisibleCount = Math.floor(viewHeight / groupHeight);

        // if all fits
        if(allFitsInView){
            return {
                groupPosition: 0,
                groupLimit: groupCount,
                elementPosition: 0,
                elementLimit: elementCount,
                visibleUpperGroupCount: upperGroupCount,
                visibleLowerGroupCount: lowerGroupCount
            };
        }

        // calculate for groups without elements
        if(expandedPosition === -1){
            let groupPosition = 0;
            const groupLimit = maxGroupsVisibleCount;
            if(scrolledToTop){
                groupPosition = 0;
            } else if(scrolledToBottom){
                groupPosition = groupCount - maxGroupsVisibleCount - 1;
            } else {
                groupPosition = (scrolledDistance / groupHeight);
            }

            return {
                groupPosition: groupPosition,
                groupLimit: groupLimit,
                elementPosition: 0,
                elementLimit: 0,
                visibleUpperGroupCount: groupLimit,
                visibleLowerGroupCount: 0
            };
        }

        // calculate for groups with elements
        // if scrolled to the top
        if(scrolledToTop){
            // if upper group occupy the view
            if(upperGroupHeight >= viewHeight){
                return {
                    groupPosition: 0,
                    groupLimit: maxGroupsVisibleCount,
                    elementPosition: 0,
                    elementLimit: 0,
                    visibleUpperGroupCount: maxGroupsVisibleCount,
                    visibleLowerGroupCount: 0
                };
            }

            let groupPosition = 0;
            let groupLimit = 0;
            let elementPosition = 0;
            let visibleUpperGroupCount = upperGroupCount;
            let visibleLowerGroupCount = 0;

            // calculate how much space we have
            let freeHeight = viewHeight - upperGroupHeight;
            // lets fit some elements
            let elementLimit = Math.floor(freeHeight / elementHeight);
            // lets provide at least one element
            elementLimit = elementLimit === 0 ? 1 : elementLimit;
            // limit to existing elements
            elementLimit = elementLimit > elementCount ? elementCount : elementLimit;

            // if more space we can add some lower groups
            freeHeight = viewHeight - upperGroupHeight - elementLimit * elementHeight;
            if(freeHeight > 0){
                visibleLowerGroupCount = Math.floor(freeHeight / groupHeight);
                // lets provide at least one element
                visibleLowerGroupCount = visibleLowerGroupCount === 0 ? 1 : visibleLowerGroupCount;
                // limit to existing elements
                visibleLowerGroupCount =
                    visibleLowerGroupCount > lowerGroupCount ? lowerGroupCount : visibleLowerGroupCount;
            }

            return {
                groupPosition: groupPosition,
                groupLimit: groupLimit,
                elementPosition: elementPosition,
                elementLimit: elementLimit,
                visibleUpperGroupCount: visibleUpperGroupCount,
                visibleLowerGroupCount: visibleLowerGroupCount
            };
        }

        // if scrolled to the bottom
        if(scrolledToBottom){
            // if scrolled past upper

            // TODO: implement

            return {
                groupPosition: 0,
                groupLimit: 0,
                elementPosition: 0,
                elementLimit: 0,
                visibleUpperGroupCount: 0,
                visibleLowerGroupCount: 0
            };
        }


        // if in the middle
        // TODO: implement
        // if on top
        // if on the bottom


        return {
            groupPosition: 0,
            groupLimit: 0,
            elementPosition: 0,
            elementLimit: 0,
            visibleUpperGroupCount: 0,
            visibleLowerGroupCount: 0
        };


        /////////////////////////////////////////////////////////////////////////////////////

        // Calculate how many groups is visible
        // const groupSnapshot = resolveGroupSnapshot(
        //     scrolledDistance,
        //     totalHeight,
        //     viewHeight,
        //     groupHeight,
        //     upperGroupHeight,
        //     lowerGroupHeight,
        //     expandedPosition,
        //     groupCount,
        //     upperGroupCount,
        //     lowerGroupCount,
        //     inUpperGroupStackArea,
        //     inLowerGroupStackArea,
        //     allFitsInView,
        //     scrolledToTop,
        //     scrolledToBottom
        // );

        // let groupPosition = groupSnapshot.position;
        // let groupLimit = groupSnapshot.limit;

        // const elementSnapshot = resolveElementSnapshot(
        //     scrolledDistance,
        //     viewHeight,
        //     groupHeight,
        //     elementHeight,
        //     upperGroupHeight,
        //     elementCount,
        //     expandedPosition,
        //     inUpperGroupStackArea,
        //     inLowerGroupStackArea,
        //     groupLimit
        // );

        // let elementPosition = elementSnapshot.position;
        // let elementLimit = elementSnapshot.limit;


        // // if we have more elements than fit in view
        // if(!allFitsInView){
        //     // double check values to eliminate unreachable elements as we do a lot of rounding in calculations
        //     const spaceLeftover = viewHeight - elementLimit * elementHeight - groupLimit * groupHeight;
        //
        //     console.log('spaceLeftover', spaceLeftover);
        //     // if free space
        //     if(spaceLeftover > 0){
        //         // if enough space to display more elements
        //         // TODO: add elements or groups
        //         console.log('free space');
        //     }
        //
        //     // if not enough space to display all
        //     if(spaceLeftover < 0 && scrolledToBottom){
        //         // TODO: remove elements or groups
        //         console.log('not enough space');
        //     }
        // }
    }

    //
    // /**
    //  * Calculate count of visible elements and form which element index to start displaying them
    //  * @param scrolledDistance {number} Distance scrolled
    //  * @param viewHeight {number} Height of the visible area
    //  * @param groupHeight {number} Single group element height
    //  * @param elementHeight {number} Single element height
    //  * @param upperGroupHeight {number} Upper group stack height
    //  * @param elementCount {number} Count of available elements
    //  * @param expandedPosition {number} Position of the expanded group
    //  * @param inUpperGroupStackArea {boolean} Are we over upper group stack
    //  * @param inLowerGroupStackArea {boolean} Are we over lower group stack
    //  * @param groupLimit {number} Calculated count of visible group elements
    //  * @return {{position: number, limit: number}}
    //  */
    // function resolveElementSnapshot(
    //     scrolledDistance,
    //     viewHeight,
    //     groupHeight,
    //     elementHeight,
    //     upperGroupHeight,
    //     elementCount,
    //     expandedPosition,
    //     inUpperGroupStackArea,
    //     inLowerGroupStackArea,
    //     groupLimit
    // ){
    //     let elementLimit = 0;
    //     let elementPosition = 0;
    //
    //     // if group expanded
    //     if(expandedPosition === -1){
    //         return {
    //             position: elementPosition,
    //             limit: elementLimit
    //         };
    //     }
    //
    //     // calculate how many elements we can fit in the screen
    //     const freeViewSize = viewHeight - groupLimit * groupHeight;
    //     const maximumElementCount = Math.floor(freeViewSize / elementHeight);
    //     // did we scrolled to the top
    //     const scrolledToTop = !scrolledDistance;
    //
    //     // if we can fit more than total elements available
    //     if(maximumElementCount >= elementCount){
    //         // display all elements onLimit
    //         return {
    //             position: elementPosition,
    //             limit: elementCount
    //         };
    //     }
    //
    //     // if we can't fit all lets show maximum and calculate where is starting element
    //     elementLimit = maximumElementCount;
    //
    //     // lets split group limit to see how many groups is visible above and below
    //     // if limit is 1 then we know expanded group is the only one visible
    //     if(groupLimit === 1){
    //         // if limit 1 or we did not scrolled pass upper group stack then we can be at the start
    //         if(scrolledToTop || inUpperGroupStackArea){
    //             elementPosition = 0;
    //             return {
    //                 position: 0,
    //                 limit: elementLimit
    //             };
    //         }
    //
    //         // calculate how many elements we scrolled past
    //         const scrolledElementDistance = scrolledDistance - upperGroupHeight;
    //
    //         return {
    //             position: Math.floor(scrolledElementDistance / elementHeight),
    //             limit: elementLimit
    //         };
    //     }
    //
    //     if(!inUpperGroupStackArea && inLowerGroupStackArea){
    //         // if only over lower stack show end of element stack
    //         return {
    //             position: elementCount - maximumElementCount,
    //             limit: elementLimit
    //         };
    //     }
    //
    //     return {
    //         position: elementPosition,
    //         limit: elementLimit
    //     };
    // }
    //
    // /**
    //  * Calculate count of visible groups and form which group index to start displaying them
    //  * @param scrolledDistance {number} Distance scrolled
    //  * @param totalHeight {number} Total height of group stacks and visible elements combined
    //  * @param viewHeight {number} Height of the visible area
    //  * @param groupHeight {number} Single group element height
    //  * @param upperGroupHeight {number} Upper group stack height
    //  * @param lowerGroupHeight {number} Lower group stack height
    //  * @param expandedPosition {number} Position of the expanded group
    //  * @param groupCount {number} Total group count
    //  * @param upperGroupCount {number} Upper group stack height
    //  * @param lowerGroupCount {number} Lower group stack height
    //  * @param inUpperGroupStackArea {boolean} Are we over upper group stack
    //  * @param inLowerGroupStackArea {boolean} Are we over lower group stack
    //  * @param allFitsInView {boolean} Does all groups & elements not exceed view height
    //  * @param scrolledToTop {boolean} Did we scrolled to the top
    //  * @param scrolledToBottom {boolean} Did we scrolled to the bottom
    //  * @return {{position: number, limit: number}}
    //  */
    // function resolveGroupSnapshot(
    //     scrolledDistance,
    //     totalHeight,
    //     viewHeight,
    //     groupHeight,
    //     upperGroupHeight,
    //     lowerGroupHeight,
    //     expandedPosition,
    //     groupCount,
    //     upperGroupCount,
    //     lowerGroupCount,
    //     inUpperGroupStackArea,
    //     inLowerGroupStackArea,
    //     allFitsInView,
    //     scrolledToTop,
    //     scrolledToBottom
    // ){
    //
    //     if(allFitsInView){
    //         return {
    //             position: 0,
    //             limit: groupCount
    //         };
    //     }
    //
    //     // if below upper limit and above lower limit hide all groups
    //     if(!inUpperGroupStackArea && !inLowerGroupStackArea){
    //         // show only expanded
    //         return {
    //             position: expandedPosition,
    //             limit: 1
    //         };
    //     }
    //
    //     let maxVisibleGroupCount = Math.ceil(viewHeight / groupHeight);
    //
    //     // if in upper stack and not lower
    //     if(inUpperGroupStackArea && !inLowerGroupStackArea){
    //         maxVisibleGroupCount = maxVisibleGroupCount <= upperGroupCount ? maxVisibleGroupCount : upperGroupCount;
    //         maxVisibleGroupCount = maxVisibleGroupCount > 0 ? maxVisibleGroupCount : 1;
    //
    //         if(scrolledToTop){
    //             // if stack has lower height than container
    //             if(upperGroupHeight <= viewHeight){
    //                 return {
    //                     position: 0,
    //                     limit: upperGroupCount
    //                 };
    //             }
    //
    //             // for stack higher than view we show all possible upper groups
    //             return {
    //                 position: 0,
    //                 limit: maxVisibleGroupCount
    //             };
    //         }
    //
    //         // if not on top lets calculate whats the upper top group to show
    //         const groupPosition = Math.round(scrolledDistance / groupHeight);
    //
    //         // if position same as an expanded one
    //         if(groupPosition === expandedPosition){
    //             return {
    //                 position: expandedPosition,
    //                 limit: 1
    //             };
    //         }
    //
    //         return {
    //             position: groupPosition,
    //             limit: upperGroupCount - groupPosition + 1
    //         };
    //     }
    //
    //
    //     // if in lower stack and not upper
    //     if(!inUpperGroupStackArea && inLowerGroupStackArea){
    //         maxVisibleGroupCount = maxVisibleGroupCount <= lowerGroupCount ? maxVisibleGroupCount : lowerGroupCount;
    //
    //     }
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //
    //     // if stack higher than container
    //     if(lowerGroupHeight > viewHeight){
    //         // if scrolled to the bottom we show all lower groups possible
    //         if(scrolledToBottom){
    //             return {
    //                 position: groupCount - groupLimit,
    //                 limit: Math.round(viewHeight / groupHeight)
    //             };
    //         }
    //         // if in the middle of the stack calculate how many groups to show
    //         const visibleGroupHeight = lowerGroupHeight + viewHeight + scrolledDistance - totalHeight;
    //
    //         return {
    //             position: expandedPosition,
    //             limit: Math.round(visibleGroupHeight / groupHeight)
    //         };
    //     }
    //
    //     // if stack height lower than container
    //     // if not all elements fit in the view
    //     if(totalHeight > viewHeight){
    //         // show from end of of upper group
    //         groupPosition = expandedPosition;
    //         groupLimit = 1;
    //     }
    //
    //     // if scrolled to the bottom show rest of groups
    //     if(scrolledToBottom){
    //         return {
    //             position: groupPosition,
    //             limit: groupLimit + lowerGroupCount
    //         };
    //     }
    //     // else calculate how many groups to show
    //     const visibleGroupHeight = lowerGroupHeight + viewHeight + scrolledDistance - totalHeight;
    //
    //     return {
    //         position: groupPosition,
    //         limit: groupLimit + Math.round(visibleGroupHeight / groupHeight)
    //     };
    // }

    /**
     * Callback on scrollbar scroll
     */
    function onScrollbarScroll(){
        ctrl.scrollbarScrollFromTop = ctrl.scrollbar.scrollTop;
        // TODO: Debounce
        resolveLimitAndPosition();
    }

    /**
     * Callback on element container scroll
     * @param event
     */
    function onContainerScroll(event){
        // scroll scrollbar to the new position
        const scrollFromTop = ctrl.scrollbar.scrollTop + event.deltaY;
        ctrl.scrollbar.scrollTop = scrollFromTop;
        event.preventDefault();

        // TODO: Debounce
        resolveLimitAndPosition(scrollFromTop);
    }

    /**
     * Calculate height of scrolling element
     */
    function resolveElementHeights(){
        ctrl.totalHeight =
            ctrl.elementHeight * ctrl.elementCount + ctrl.groupElementHeight * ctrl.groupElementCount;

        // if no group expanded
        if(ctrl.groupExpandedPosition === -1){
            // upper group contains all ellements
            ctrl.upperGroupStackCount = ctrl.groupElementCount;
        } else {
            // if any expanded
            ctrl.upperGroupStackCount = ctrl.groupExpandedPosition + 1;
        }
        // calculate group stack heights
        ctrl.upperGroupStackHeight = ctrl.upperGroupStackCount * ctrl.groupElementHeight;
        ctrl.lowerGroupStackCount = ctrl.groupElementCount - ctrl.upperGroupStackCount;
        ctrl.lowerGroupStackHeight = ctrl.groupElementHeight * ctrl.lowerGroupStackCount;

        // set height of root container
        ctrl.viewHeight = ctrl.containerElement.clientHeight;
        ctrl.scrollbar.style.height = `${ctrl.viewHeight}px`;

        // set height of container that should be scrolled
        ctrl.containerFiller.style.height = `${ctrl.totalHeight}px`;
    }

    /**
     * On input change callback
     * @param changes {any}
     */
    function inputChange(changes){
        let redrawRequired = false;
        let resolveHeightsRequired = false;

        if(changes.groupCount){
            if(Number.isInteger(changes.groupCount.currentValue)){
                ctrl.groupElementCount = changes.groupCount.currentValue;
            } else {
                ctrl.groupElementCount = 0;
            }
            redrawRequired = true;
            resolveHeightsRequired = true;
        }

        if(changes.groupHeight){
            if(Number.isInteger(changes.groupHeight.currentValue)){
                ctrl.groupElementHeight = changes.groupHeight.currentValue;
            } else {
                ctrl.groupElementHeight = 0;
            }
            redrawRequired = true;
            resolveHeightsRequired = true;
        }

        if(changes.groupExpanded){
            if(Number.isInteger(changes.groupExpanded.currentValue)){
                ctrl.groupExpandedPosition = changes.groupExpanded.currentValue;
            } else {
                ctrl.groupExpandedPosition = -1;
            }
            redrawRequired = true;
            resolveHeightsRequired = true;
        }

        if(changes.count){
            if(Number.isInteger(changes.count.currentValue)){
                ctrl.elementCount = changes.count.currentValue;
            } else {
                ctrl.elementCount = 0;
            }
            redrawRequired = true;
            resolveHeightsRequired = true;
        }

        if(changes.height){
            if(Number.isInteger(changes.height.currentValue)){
                ctrl.elementHeight = changes.height.currentValue;
            } else {
                ctrl.elementHeight = 0;
            }
            redrawRequired = true;
            resolveHeightsRequired = true;
        }

        if(changes.container){
            // detach event from existing container
            teardownContainerEvent();

            if(changes.container.currentValue){
                ctrl.containerElement = changes.container.currentValue;
                // set event on new container
                setupContainerEvent();
            }
            redrawRequired = true;
            resolveHeightsRequired = true;
        }

        if(resolveHeightsRequired){
            // if component ready for calculation
            if(isComponentReady()){
                resolveElementHeights();
            }
        }
        if(redrawRequired){
            // if component ready for calculation
            if(isComponentReady()){
                resolveLimitAndPosition();
            }
            ctrl.redraw();
        }
    }

    /**
     * Checks if component ready for calculations e.g. all elements mounted etc
     * @return {boolean}
     */
    function isComponentReady(){
        return !!(ctrl.scrollbar && ctrl.containerElement && ctrl.containerFiller);
    }

    /**
     * Notify about limit change
     */
    function onScrollChange(){
        // notify of change
        ctrl.onChange({
            elementLimit: ctrl.visibleElementLimit,
            elementPosition: ctrl.visibleElementPosition,
            groupLimit: ctrl.visibleGroupLimit,
            groupPosition: ctrl.visibleGroupPosition
        });
    }

    /**
     * On component destroy
     */
    function onDestroy(){
        teardownScrollbarEvent();
        teardownContainerEvent();
    }

    /**
     * Setup scrollbar events
     */
    function setupScrollbarEvent(){
        // on scrollbar scroll
        ctrl.scrollbar.addEventListener('scroll', ctrl.onScrollbarScroll);
    }

    /**
     * Destroy scrollbar events
     */
    function teardownScrollbarEvent(){
        if(ctrl.containerFiller){
            // Remove listener on scrollbar
            ctrl.scrollbar.removeEventListener("scroll", ctrl.onScrollbarScroll);
        }
    }

    /**
     * Setup container event
     */
    function setupContainerEvent(){
        ctrl.containerElement.addEventListener("wheel", ctrl.onContainerScroll);
    }

    /**
     * Destroy container event
     */
    function teardownContainerEvent(){
        if(ctrl.containerElement){
            // Remove listener on container
            ctrl.containerElement.removeEventListener("wheel", ctrl.onContainerScroll);
        }
    }

    /**
     * Manual redraw of components
     */
    function redraw(){
        $scope.$applyAsync();
    }
}
