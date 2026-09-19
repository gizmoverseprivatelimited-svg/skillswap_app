import React from 'react';
import { View } from 'react-native';

export default React.forwardRef((props: any, ref: any) => (
  <View ref={ref} {...props} />
));
