export const DefaultLatency = 100;

export const ButtonOptions = Object.freeze({
    width: 0.5,
    height: 0.2,
    justifyContent: 'center',
    offset: 0.05,
    margin: 0.02,
    borderRadius: 0.075
});

export const Experiments = Object.freeze({
    LowPolyLocal:   'Local',// 'Low Poly Local',
    // HighPolyLocal:  'High Poly Local',
    RemoteATW:      'Remote',
    MixedATW:       'Mixed',
});

export const ExperimentsList = Object.values(Experiments);

export const RenderingMedium = Object.freeze({
    Local:  'local',
    Remote: 'remote',
});

export const Resolution = Object.freeze({
    Low:    'low',
    High:   'high',
});

export const EVENTS = Object.freeze({
    RAYCASTER_INTERSECT_LOCAL:      'raycaster-custom-intersected-local',
    RAYCASTER_INTERSECT_REMOTE:     'raycaster-custom-intersected-remote',
    HAND_GRAB_START_LOCAL:          'hand-grab-start-local',
    HAND_GRAB_START_REMOTE:         'hand-grab-start-remote',
    HAND_GRAB_END_LOCAL:            'hand-grab-end-local',
    HAND_GRAB_END_REMOTE:           'hand-grab-end-remote',
    BUTTON_RESET_PRESSED:           'button-reset-pressed',
});

export const Task = Object.freeze({
    Idle:           'Idle',
    Reset:          'Reset',
    HighDexterity:  'High Dexterity',
    LowDexterity:   'Low Dexterity',
    Done:           'Done',
});

export const TaskList = Object.values([Task.HighDexterity, Task.LowDexterity]);
